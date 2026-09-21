// ATD Control Node — three-pulley ATD X/Y position monitoring over GSM.
// Posts telemetry to Firebase Realtime Database.
//
// Firebase contract:
//   PUT /{POLE_ID}.json?auth={DB_SECRET}
//   body: { x_m, y_m, temp_c, voltage_v, time, x_status, y_status }
//   -> 200 with the same JSON echoed back
//
// The pole ID is the root of the data in the database:
//
//   ATD-001
//     x_m      : 2.179
//     y_m      : 2.355
//     temp_c   : 31.4
//     voltage_v: 5.0
//     time     : "2026-09-19 14:32:10"
//     x_status : "OK"
//     y_status : "OK"
//
// HTTPS over the A7672S needs SSL configured before AT+HTTPINIT, or
// AT+HTTPACTION returns code 0 with no explanation.

#include <Arduino.h>
#include <time.h>
#include <sys/time.h>

// Supply voltage sent to Firebase. Fixed at 5 V for now.
#define SUPPLY_V    5.0

// Time zone used when formatting the time. India = IST, UTC+5:30.
#define TZ_POSIX    "IST-5:30"
#define TZ_QUARTERS 22            // +5:30 in quarter-hours, used for NTP sync

#define SERVER      "https://atdanantkaal-default-rtdb.asia-southeast1.firebasedatabase.app"
#define POLE_ID     "ATD-001"
#define DB_SECRET   "08z6h412iNxhLnjsKjRKGcOCq0fThhF0AkZNFrmq"
#define API_PATH    "/" POLE_ID ".json?auth=" DB_SECRET
#define APN         "iot"

// 4 = PUT  -> overwrites ATD-001 each time (always the latest reading)
// 1 = POST -> adds a new entry under ATD-001 each time (keeps history)
#define HTTP_METHOD 4

#define UPLOAD_PERIOD  60000UL

#define NTC_PIN     34
#define NTC_R25     10000.0
#define NTC_BETA    3950.0
#define SERIES_R    10000.0

HardwareSerial rs485(1);
HardwareSerial gsm(2);

#define RS_RX     5
#define RS_TX     4
#define RS_DE     18
#define RS_BAUD   9600

#define GSM_RX    16
#define GSM_TX    17

uint16_t distX = 0, distY = 0;
bool     validX = false, validY = false;
unsigned long lastRxX = 0, lastRxY = 0;

bool     timeSynced = false;
uint32_t txOK = 0, txFail = 0;
int      lastHttpCode = 0;

// ================= NTC =================
float readTemp() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogRead(NTC_PIN); delay(2); }
  float adc = sum / 16.0;

  if (adc < 10 || adc > 4085) return -999;

  float v = adc / 4095.0;
  float rNTC = SERIES_R * v / (1.0 - v);
  float tK = 1.0 / (1.0/298.15 + log(rNTC/NTC_R25)/NTC_BETA);
  return tK - 273.15;
}

// ================= RS485 =================
void parsePacket() {
  static char buf[32];
  static uint8_t idx = 0;

  while (rs485.available()) {
    char c = rs485.read();

    if (c == '$') { idx = 0; buf[idx++] = c; }
    else if (idx > 0 && idx < 31) {
      buf[idx++] = c;

      if (c == '#') {
        buf[idx] = 0;
        char id, st;
        unsigned int mm;

        if (sscanf(buf, "$%c,%u,%c#", &id, &mm, &st) == 3) {
          if (id == 'X') {
            distX = mm; validX = (st == 'O'); lastRxX = millis();
          } else if (id == 'Y') {
            distY = mm; validY = (st == 'O'); lastRxY = millis();
          }
        }
        idx = 0;
      }
    }
  }
}

const char* statusStr(bool alive, bool valid) {
  if (!alive) return "DOWN";
  return valid ? "OK" : "FAULT";
}

// ================= GSM =================
String gsmCmd(const char* cmd, int wait = 2000) {
  gsm.println(cmd);
  String resp = "";
  unsigned long t = millis();
  while (millis() - t < wait) {
    while (gsm.available()) resp += (char)gsm.read();
  }
  Serial.printf(">> %s\n%s\n", cmd, resp.c_str());
  return resp;
}

bool gsmInit() {
  gsmCmd("AT");
  gsmCmd("ATE0");
  gsmCmd("AT+CPIN?");
  gsmCmd("AT+CSQ");

  String r = gsmCmd("AT+CGREG?", 3000);
  if (r.indexOf(",1") < 0 && r.indexOf(",5") < 0) {
    Serial.println("!! Network not registered");
    return false;
  }

  char apn[64];
  snprintf(apn, sizeof(apn), "AT+CGDCONT=1,\"IP\",\"%s\"", APN);
  gsmCmd(apn);
  gsmCmd("AT+NETOPEN", 10000);

  // TLS 1.2, no certificate verification. Needed before any HTTPS URL —
  // without it AT+HTTPACTION returns code 0 and the request never leaves
  // the module. Syntax differs slightly across A7672S/SIM7600 firmware
  // revisions; if these return ERROR, check your module's AT manual.
  gsmCmd("AT+CSSLCFG=\"sslversion\",0,4", 1000);
  gsmCmd("AT+CSSLCFG=\"authmode\",0,0", 1000);
  // Firebase's servers need the host name sent during the TLS handshake (SNI)
  gsmCmd("AT+CSSLCFG=\"enableSNI\",0,1", 1000);

  // Let the network update the module clock (used to get the current time)
  gsmCmd("AT+CTZU=1", 1000);

  return true;
}

// Reads the module clock and sets the ESP32 system time, so time.h works.
// Falls back to an NTP sync through the modem if the network clock is empty.
bool syncTime() {
  for (int attempt = 0; attempt < 2; attempt++) {
    String r = gsmCmd("AT+CCLK?", 1000);
    int q = r.indexOf('"');
    int yy, mo, d, h, mi, s, tz;
    // +CCLK: "26/09/19,14:32:10+22"   (tz is in quarter-hours)
    // An unsynced module reports its default date "70/01/01", so only accept 2024-2060.
    if (q >= 0 && sscanf(r.c_str() + q + 1, "%d/%d/%d,%d:%d:%d%d", &yy, &mo, &d, &h, &mi, &s, &tz) == 7 && yy >= 24 && yy <= 60) {
      struct tm t = {};
      t.tm_year = yy + 100;
      t.tm_mon  = mo - 1;
      t.tm_mday = d;
      t.tm_hour = h;
      t.tm_min  = mi;
      t.tm_sec  = s;

      setenv("TZ", "UTC0", 1);
      tzset();
      time_t utc = mktime(&t) - (time_t)tz * 900;   // module time is local; convert to UTC
      struct timeval tv = { utc, 0 };
      settimeofday(&tv, NULL);

      setenv("TZ", TZ_POSIX, 1);
      tzset();
      timeSynced = true;
      Serial.println("Time synced");
      return true;
    }
    if (attempt == 0) {
      char ntp[48];
      snprintf(ntp, sizeof(ntp), "AT+CNTP=\"pool.ntp.org\",%d", TZ_QUARTERS);
      gsmCmd(ntp, 1000);
      gsmCmd("AT+CNTP", 8000);
    }
  }
  Serial.println("!! Time not available from the module");
  return false;
}

bool sendTelemetry(float tempC) {
  // Pole ID is the root of the data (see the URL path). The body is the
  // key/value data stored under it.
  if (!timeSynced) syncTime();

  char timeStr[24] = "NA";
  if (timeSynced) {
    time_t now = time(nullptr);
    struct tm ti;
    localtime_r(&now, &ti);
    strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &ti);
  }

  char body[340];
  snprintf(body, sizeof(body),
    "{\"x_m\":%.3f,\"y_m\":%.3f,"
    "\"temp_c\":%.1f,\"voltage_v\":%.1f,\"time\":\"%s\","
    "\"x_status\":\"%s\",\"y_status\":\"%s\"}",
    distX / 1000.0, distY / 1000.0,
    tempC, SUPPLY_V, timeStr,
    statusStr(millis() - lastRxX < 3000, validX),
    statusStr(millis() - lastRxY < 3000, validY));

  Serial.printf("\nPayload: %s\n", body);

  gsmCmd("AT+HTTPTERM", 1000);
  gsmCmd("AT+HTTPINIT", 3000);

  char url[260];
  snprintf(url, sizeof(url), "AT+HTTPPARA=\"URL\",\"%s%s\"", SERVER, API_PATH);
  gsmCmd(url, 2000);

  gsmCmd("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 1000);
  gsmCmd("AT+HTTPPARA=\"SSLCFG\",0", 1000);

  // No custom header needed: Firebase reads the secret from ?auth= in the URL.

  char dataCmd[48];
  snprintf(dataCmd, sizeof(dataCmd), "AT+HTTPDATA=%d,10000", (int)strlen(body));
  gsmCmd(dataCmd, 2000);

  gsm.print(body);
  delay(2000);
  while (gsm.available()) Serial.write(gsm.read());

  char action[24];
  snprintf(action, sizeof(action), "AT+HTTPACTION=%d", HTTP_METHOD);
  String r = gsmCmd(action, 20000);
  String resp = gsmCmd("AT+HTTPREAD=0,300", 3000);
  gsmCmd("AT+HTTPTERM", 1000);

  // +HTTPACTION: 4,200,123  -> the middle number is the HTTP status
  int httpCode = 0;
  int p = r.indexOf("+HTTPACTION:");
  if (p >= 0) {
    int c1 = r.indexOf(',', p);
    int c2 = r.indexOf(',', c1 + 1);
    if (c1 > 0 && c2 > 0) httpCode = r.substring(c1 + 1, c2).toInt();
  }

  lastHttpCode = httpCode;

  // Firebase answers 200 and echoes the saved JSON back.
  bool ok = (httpCode == 200 || httpCode == 204);
  if (ok) txOK++; else txFail++;

  Serial.printf("HTTP code: %d\n", httpCode);

  if (!ok) {
    switch (httpCode) {
      case 400: Serial.println("  400 — bad request, check the JSON body and the URL"); break;
      case 401: Serial.println("  401 — database secret wrong or revoked"); break;
      case 404: Serial.println("  404 — check the database URL"); break;
      case 0:   Serial.println("  0 — request never left the module: SSL config or no data session"); break;
    }
  }

  return ok;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.printf("Pole ID   : %s\n", POLE_ID);
  Serial.printf("Endpoint  : %s/%s.json\n", SERVER, POLE_ID);

  pinMode(RS_DE, OUTPUT);
  digitalWrite(RS_DE, LOW);
  analogSetPinAttenuation(NTC_PIN, ADC_11db);

  rs485.setRxBufferSize(512);
  rs485.begin(RS_BAUD, SERIAL_8N1, RS_RX, RS_TX);

  gsm.begin(115200, SERIAL_8N1, GSM_RX, GSM_TX);
  Serial.println("GSM init...");
  delay(10000);
  gsmInit();

  Serial.println("\n=== ATD Control Node ===");
}

// ================= LOOP =================
void loop() {
  parsePacket();

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 1000) {
    lastPrint = millis();

    bool aliveX = (millis() - lastRxX < 3000);
    bool aliveY = (millis() - lastRxY < 3000);
    float tempC = readTemp();

    Serial.printf("X: %5u mm (%.3f m) [%-5s]  Y: %5u mm (%.3f m) [%-5s]  T: %.1f C\n",
                  distX, distX / 1000.0, statusStr(aliveX, validX),
                  distY, distY / 1000.0, statusStr(aliveY, validY),
                  tempC);
  }

  static unsigned long lastUpload = 0;
  if (millis() - lastUpload > UPLOAD_PERIOD) {
    lastUpload = millis();

    float t = readTemp();
    bool ok = sendTelemetry(t);
    Serial.printf("=== Upload %s | OK:%lu FAIL:%lu | code:%d ===\n\n",
                  ok ? "SUCCESS" : "FAILED", txOK, txFail, lastHttpCode);
  }
}
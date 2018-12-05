#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>
#include <stdint.h>

enum UART_Commands
{
  UART_PasswordFail = 1,
  UART_PasswordSuccess = 2,
  UART_SoundAlarm = 3,
  UART_DisableAlarm = 4,
  UART_ClearPassword = 5,
  UART_AllowSensorData = 7,
  UART_StopSensorData = 8,
  UART_Unlock = 9,
  UART_Lock = 10,
};

typedef uint8_t u8;

String url = String("localhost:3000");

const char* ssidArray[4] = {"ATT6TZd8ua", "Shitty WiFi", "UCInet Mobile Access", "VDCN-Resident",};
const char* passArray[4] = {"Gbsepul200", "badcableline", "", "AC86fm!6",};
int chosenNetwork = 2;
char passcode[7] = "XXXXXX";
int passcnt = 0;
char incomingByte = 0;
int alarmSent = 0;
SoftwareSerial mySerial(2,14, false, 128);
StaticJsonBuffer<512> jsonBuffer;
HTTPClient http;

void clearPass()
{
  passcnt = 0;
  for (int i = 0; i < 6; ++i)
  {
    passcode[i] = 'X';
  }
  Serial.println(passcode);
  mySerial.write(UART_ClearPassword);
}

int isOpen()
{
  if (digitalRead(12) == LOW)
  {
    return 1;
  }
  return 0;
}

void waitForSerialData()
{
  while(mySerial.available() == 0)
  {
    delay(5);
  }
}

void setup() {
  Serial.begin(115200);
  mySerial.begin(9600);
  pinMode(4, OUTPUT);
  pinMode(12, INPUT);
 
  Serial.println("Connecting to WiFi");
  //ESP.wdtDisable();
  WiFi.begin(ssidArray[chosenNetwork], passArray[chosenNetwork]);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected to WiFi");
  mySerial.write(UART_AllowSensorData);
}

void flushSerial()
{
  while(mySerial.available() > 0)
  {
    int t = mySerial.read();
  }
}

int sendJSONToServer(JsonObject& obj)
{
  u8 dataToSend[256];
  obj.printTo((char*) dataToSend, obj.measureLength()+1);
  http.begin("http://68.183.164.250:3000/iot_status");
  http.addHeader("Content-Type", "application/json");
  Serial.printf("Sending payload: %s\n", dataToSend);
  int httpResp = http.POST(dataToSend, obj.measureLength());
  return httpResp;
}

void sendAlarm(String alertType)
{
  while (isOpen())
  {
    if (!alarmSent)
    {
      tone(5, 3520);
      mySerial.write(UART_SoundAlarm);
      jsonBuffer.clear();
      JsonObject& alert = jsonBuffer.createObject();
      alert["secret"] = "alakazam";
      alert["type"] = alertType;
      sendJSONToServer(alert);
      alarmSent = 1;
    }
    delay(250);
  }
  noTone(5);
  mySerial.write(UART_DisableAlarm);
  alarmSent = 0;
}

void allowAccess(int life)
{
  mySerial.write(UART_Unlock);
  delay(1000*life);
}

void loop() {
  jsonBuffer.clear();
  if (mySerial.available() > 0)
  {
    incomingByte = mySerial.read();
    if (incomingByte >= '0' && incomingByte <= '9')
    {
      passcode[passcnt++] = incomingByte;
      Serial.println(passcode);
    }
    else if (incomingByte == UART_ClearPassword)
    {
      clearPass();
    }
    
  }
  if (isOpen())
  {
    sendAlarm("a2");
  }
  
  if(passcnt == 6 && WiFi.status() == WL_CONNECTED)
  {
    mySerial.write(UART_StopSensorData);
    JsonObject& root = jsonBuffer.createObject();
    root["secret"] = "alakazam";
    root["type"] = "p";
    root["pass"] = passcode;
    int httpCode = sendJSONToServer(root);
    if (httpCode > 0)
    {
      JsonObject& response = jsonBuffer.parse(http.getString());
      response.printTo(Serial);
      int succ = response["ok"];
      int life = response["life"];
      Serial.println(succ);
   
      if (succ == 1)
      {
        mySerial.write(UART_PasswordSuccess);
        allowAccess(life);
        if (isOpen())
        {
          sendAlarm("a1");
        }
        delay(3000);
        mySerial.write(UART_Lock);    
      }
      else
      {
        mySerial.write(UART_PasswordFail);
      }
    }
    else
    {
      Serial.print("Error on http request ");
      Serial.println(httpCode);
      mySerial.write(UART_PasswordFail);
    }
    clearPass();
    http.end();
    flushSerial();
    mySerial.write(UART_ClearPassword);
    mySerial.write(UART_AllowSensorData);
  }
}

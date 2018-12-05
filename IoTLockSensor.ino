#include "rgb_lcd.h"
#include "Keypad.h"
#include "SoftwareSerial.h"
#include <Servo.h>
#include <math.h>

#define LIGHT_SENSOR_PIN A0
#define MAX_DISTANCE 250L //centimeters
#define SPEED_SOUND 34000L //centimeters per second
#define MICROSECONDS 1000000L
#define ECHO_TIMEOUT ((MAX_DISTANCE * 2 * MICROSECONDS) / SPEED_SOUND)

enum uart_command
{
  UART_PasswordFail = 1,
  UART_PasswordSuccess = 2,
  UART_SoundAlarm = 3,
  UART_DisableAlarm = 4,
  UART_ClearPassword = 5,
  UART_SensorData = 6,
  UART_AllowSensorData = 7,
  UART_StopSensorData = 8,
  UART_Unlock = 9,
  UART_Lock = 10,
  UART_LightSuspect = 11,
  UART_LightFine = 12,
};

rgb_lcd lcd;
int passcnt;
int alarm_on;
int trigPin = 4;
int echoPin = 5;

const byte rows = 4; //four rows
const byte cols = 4; //three columns
char keys[rows*cols] = {
  '1','2','3','A',
  '4','5','6','B',
  '7','8','9','C',
  '*','0','#','D'
};
byte colPins[cols] = {10, 11, 12, 13}; //connect to the row pinouts of the keypad
byte rowPins[rows] = {6, 7, 8, 9}; //connect to the column pinouts of the keypad
Keypad myKey = Keypad(keys, rowPins, colPins, rows, cols);
SoftwareSerial mySerial(2, 3);//RX, TX
int canSendSensorData;
Servo myservo;

void openLock()
{
  Serial.println("UNLOCKING");
  myservo.write(1);
}

void closeLock()
{
  Serial.println("LOCKING");
  myservo.write(120);
}

void setup() {
  Serial.begin(9600);
  mySerial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  lcd.begin(16, 2);
  passcnt = 0;
  alarm_on = 0;
  canSendSensorData = 0;
  myservo.attach(A3);
  myservo.write(120);
}

void loop() {
  char key = myKey.getKey();
  if(key >= '0' && key <= '9' && passcnt < 6 && !alarm_on && canSendSensorData)
  {
    lcd.print(key);
    ++passcnt;
    mySerial.print(key);
  }
  if(key == '*' && canSendSensorData)
  {
      lcd.clear();
      passcnt = 0;
      mySerial.print(UART_ClearPassword);
  }
  else
  {
    mySerial.write(UART_LightFine);
  }

  if(mySerial.available() > 0)
  {
    int incomingByte = mySerial.read();
    uart_command type = (uart_command) incomingByte;
    switch(type)
    {
      case UART_PasswordFail:
        lcd.setRGB(255, 0, 0);
        delay(2000);
        lcd.setRGB(255, 255, 255);
        break;
      case UART_PasswordSuccess:
        lcd.setRGB(0, 255, 0);
        delay(2000);
        lcd.setRGB(255, 255, 255);
        break;
      case UART_ClearPassword:
        passcnt = 0;
        lcd.clear();
        break;
      case UART_SoundAlarm:
        alarm_on = 1;
        break;
      case UART_DisableAlarm:
        alarm_on = 0;
        break;
      case UART_AllowSensorData:
        canSendSensorData = 1;
        break;
      case UART_StopSensorData:
        canSendSensorData = 0;
        break;
      case UART_Lock:
        closeLock();
        break;
      case UART_Unlock:
        openLock();
        break;
      default:
        break;
    } 
    if (alarm_on)
    {
      lcd.setRGB(255, 100, 0);
    }
    else
    {
      lcd.setRGB(255, 255, 255);
    }
  }
  delay(100);
}

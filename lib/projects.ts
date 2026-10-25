import type { BuildStep, Connection, PartInstance, Project, Vec3 } from './types';

const instance = (id:string,libraryId:string,label:string,role:string,position:Vec3,layer:number,watchOut?:string,quantity=1):PartInstance => ({id,libraryId,label,role,quantity,assembledPosition:position,rotation:[0,0,0],explodeDirection:layer===0?[0,0,0]:[position[0]*0.025,1,position[2]*0.025],explodeDistance:layer===0?0:35+layer*16,layer,...(watchOut?{watchOut}:{})});
const wire = (id:string,fromPart:string,fromPin:string,toPart:string,toPin:string,kind:Connection['kind'],purpose:string,wireColor:Connection['wireColor']=kind==='power'?'red':kind==='ground'?'black':'blue',signalDirection:Connection['signalDirection']='from-to'):Connection => ({id,from:{partId:fromPart,pin:fromPin},to:{partId:toPart,pin:toPin},kind,wireColor,purpose,signalDirection});
const step = (index:number,title:string,instructions:string,partIds:string[],connectionIds:string[]=[],tip?:string,check?:string):BuildStep=>({index,title,instructions,partIds,connectionIds,...(tip?{tip}:{}),...(check?{check}:{}),camera:{position:index===10?[150,115,160]:[115,95,110],target:[0,index===1?6:25,0]}});
const baseParts = ():PartInstance[]=>[
  instance('base','enclosure-bottom','H1','Supports the unplugged breadboard assembly.',[0,4,0],0),
  instance('board','breadboard','B1','Holds fitted headers and plug-in leads without soldering.',[0,13,0],1),
  instance('leads','jumper-wires','W1','A set of 20 leads for the connections shown.',[-42,21,25],1),
  instance('usb','usb-cable','P1','Provides USB data and regulated 5 V to the board through its USB connector.',[-37,26,-29],2,'Use a data cable matching the board connector; keep it unplugged while wiring.'),
  instance('lid','enclosure-top','H2','Protective cover, loosely fitted only after wiring is checked.',[0,53,0],5,'The pictured case is illustrative. Dry-fit openings and keep the display and sensors exposed.'),
  instance('fasteners','screw-m3','M1','Four nylon fasteners secure the removable lid.',[47,58,33],6,undefined,4),
];
const startSteps=(controller:string,peripherals:string[],placement:string)=>[
  step(1,'Prepare the base and breadboard','Keep USB and every other power source disconnected. Place the breadboard in the case base and lay out the jumper leads. Work on a dry, clear surface.',['base','board','leads'],[],'All modules must have fitted headers or factory-fitted leads; no soldering is required.'),
  step(2,`Place the ${controller}`,'Seat the controller so its two header rows remain electrically separate. Leave the USB connector accessible and inspect the printed pin names. Keep the power cable unplugged.',['mcu'],[],'The 3D wire anchors are a pin map, not a scale PCB routing drawing. Use the board silkscreen for physical wiring.'),
  step(3,'Place the remaining components',placement,peripherals),
];
const endSteps=(test:string):BuildStep[]=>[
  step(8,'Connect power after the wiring check','Check every red and black lead and remove loose wire strands. Only now attach the USB cable to the controller and your computer. Do not add or move jumpers while power is connected.',['usb'],['usb-power'],'USB is shown as one bundled connection: VBUS, ground and data are inside the cable.'),
  step(9,'Fit the protective lid','Route the cable through its opening and loosely fit the cover and four nylon fasteners. Keep the screen and sensor face accessible. Leave the lid removable until testing is complete.',['lid','fasteners'],[],'Dry-fit the actual case; the illustrated shell does not define a printable hole pattern.'),
  step(10,'Upload the code and test',test,[],[],'Open the Code tab for the complete .ino file and its exact library list.','Select the correct board and USB port, upload, then open Serial Monitor at 115200 baud.'),
];

const HEART_CODE = `// Pulse Pal — ESP32 DevKitC / MAX30102 / SSD1306
// Install: SparkFun MAX3010x Pulse and Proximity Sensor Library,
// Adafruit SSD1306, Adafruit GFX Library (and dependencies).
// Board: ESP32 Dev Module. SDA=21, SCL=22, all sensor rails=3.3 V.
// Educational pulse estimate only; not a medical or diagnostic device.
#include <Wire.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
MAX30105 pulseSensor;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool displayOK = false;
uint32_t lastBeat = 0, lastScreen = 0;
float bpm = 0;
float rates[4] = {0,0,0,0};
uint8_t rateIndex = 0, rateCount = 0;
bool fingerPresent = false;
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.setClock(400000);
  displayOK = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (!pulseSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 missing. Unplug USB; check 3V3/GND/SDA/SCL.");
    if (displayOK) { display.clearDisplay(); display.setTextSize(1); display.setTextColor(SSD1306_WHITE); display.setCursor(0,0); display.println("Sensor not found"); display.display(); }
    while (true) delay(1000);
  }
  // LED brightness, sample average, red+IR mode, sample rate, pulse width, ADC range.
  pulseSensor.setup(0x1F, 4, 2, 100, 411, 4096);
  pulseSensor.setPulseAmplitudeGreen(0);
  Serial.println("Rest a finger gently on the optical window. Hold still for several beats.");
}
void loop() {
  pulseSensor.check();
  while (pulseSensor.available()) {
    long ir = pulseSensor.getFIFOIR();
    pulseSensor.nextSample();
    fingerPresent = ir > 50000; // Adjust only if your module's raw IR range differs.
    if (!fingerPresent) { bpm=0; lastBeat=0; rateCount=0; rateIndex=0; continue; }
    if (checkForBeat(ir)) {
      uint32_t now = millis();
      uint32_t interval = now - lastBeat;
      if (lastBeat && interval > 300 && interval < 2000) {
        rates[rateIndex] = 60000.0f / interval;
        rateIndex = (rateIndex+1) % 4;
        if (rateCount < 4) rateCount++;
        float sum=0;
        for (uint8_t i=0;i<rateCount;i++) sum += rates[i];
        bpm = sum / rateCount;
      }
      lastBeat = now;
    }
  }
  if (lastBeat && millis()-lastBeat > 3000) bpm=0;
  if (millis()-lastScreen >= 250) {
    lastScreen=millis();
    Serial.print("Finger: "); Serial.print(fingerPresent?"yes":"no");
    Serial.print("  BPM estimate: "); Serial.println(bpm,1);
    if (displayOK) {
      display.clearDisplay(); display.setTextColor(SSD1306_WHITE);
      display.setTextSize(1); display.setCursor(0,0); display.println("PULSE PAL");
      display.setCursor(0,16); display.setTextSize(2);
      if (bpm>0) { display.print(bpm,0); display.print(" BPM"); }
      else { display.setTextSize(1); display.println(fingerPresent?"Hold still...":"Place your finger"); }
      display.setTextSize(1); display.setCursor(0,52); display.println("Learning prototype");
      display.display();
    }
  }
}
`;

const WEATHER_CODE = `// Pocket Forecast — ESP32 DevKitC, DHT22, SSD1306
// Install: DHT sensor library by Adafruit, Adafruit Unified Sensor,
// Adafruit SSD1306, Adafruit GFX Library (and dependencies).
// DHT DATA=GPIO27, with 10k pull-up to 3V3. OLED SDA=21/SCL=22.
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
DHT climate(27, DHT22);
Adafruit_SSD1306 display(128,64,&Wire,-1);
bool displayOK=false;
uint32_t sampledAt=0;
void setup() {
  Serial.begin(115200);
  Wire.begin(21,22);
  displayOK=display.begin(SSD1306_SWITCHCAPVCC,0x3C);
  climate.begin();
  Serial.println("Pocket Forecast. First reading after 2.5 seconds.");
  if (!displayOK) Serial.println("OLED absent at 0x3C; measurements still appear on Serial.");
}
void loop() {
  if (millis()-sampledAt < 2500) return;
  sampledAt=millis();
  float humidity=climate.readHumidity();
  float temperature=climate.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT read failed. Unplug power and check DATA pull-up, pin order, and VCC.");
    if (displayOK) {
      display.clearDisplay(); display.setTextColor(SSD1306_WHITE); display.setTextSize(1);
      display.setCursor(0,0); display.println("DHT read failed"); display.println("Check wiring"); display.display();
    }
    return;
  }
  Serial.print("Temperature: "); Serial.print(temperature,1); Serial.print(" C   Humidity: ");
  Serial.print(humidity,1); Serial.println(" %");
  if (displayOK) {
    display.clearDisplay(); display.setTextColor(SSD1306_WHITE); display.setTextSize(1);
    display.setCursor(0,0); display.println("POCKET FORECAST");
    display.setTextSize(2); display.setCursor(0,19); display.print(temperature,1); display.println(" C");
    display.setCursor(0,43); display.print(humidity,0); display.println(" % RH"); display.display();
  }
}
`;

const PLANT_CODE = `// Little Sprout — classic Arduino Nano, SEN0193, active-LOW relay
// No external libraries. EEPROM is part of the Arduino AVR board package.
// Soil AOUT=A0; relay IN=D7. Pump has its OWN regulated 5V supply.
// Keep pump supply positive separate from the Nano's USB/5V rail.
// Serial commands: d=record dry, w=record wet, a=arm, x=disarm.
// Calibration is saved to EEPROM; automatic watering is OFF at every reboot.
#include <EEPROM.h>
const uint8_t RELAY=7, SOIL=A0;
const uint32_t PUMP_MS=1500, REST_MS=30000;
struct Calibration { uint16_t magic; int dry; int wet; };
Calibration calibration;
bool armed=false, pumping=false;
uint32_t pumpStarted=0, lastWatered=0, sampledAt=0;
int moisture=0, raw=0;
int readSoil() { long total=0; for (uint8_t i=0;i<16;i++) total+=analogRead(SOIL); return total/16; }
bool calibrated() { return calibration.magic==0x5073 && calibration.dry>calibration.wet+50; }
void stopPump() { digitalWrite(RELAY,HIGH); if(pumping) lastWatered=millis(); pumping=false; }
void saveCalibration() { calibration.magic=0x5073; EEPROM.put(0,calibration); }
void setup() {
  digitalWrite(RELAY,HIGH); // Set output latch BEFORE pinMode to avoid a startup pulse.
  pinMode(RELAY,OUTPUT);
  Serial.begin(115200);
  EEPROM.get(0,calibration);
  if(calibration.magic!=0x5073) { calibration.magic=0; calibration.dry=0; calibration.wet=0; }
  lastWatered=millis();
  Serial.println("DISARMED. In dry soil send d, in wet soil send w, then a to arm. x stops immediately.");
  Serial.println("Keep only the sensing section in soil; do not immerse the electronics.");
}
void loop() {
  while(Serial.available()) {
    char command=Serial.read();
    if(command=='x') { armed=false; stopPump(); Serial.println("DISARMED"); }
    if(command=='d') { armed=false; stopPump(); calibration.dry=readSoil(); saveCalibration(); Serial.print("Dry saved: "); Serial.println(calibration.dry); }
    if(command=='w') { armed=false; stopPump(); calibration.wet=readSoil(); saveCalibration(); Serial.print("Wet saved: "); Serial.println(calibration.wet); }
    if(command=='a') {
      armed=calibrated(); lastWatered=millis();
      Serial.println(armed?"ARMED: 30 second settling delay; watering below 30% relative moisture.":"Not armed: record dry and wet readings at least 50 counts apart first.");
    }
  }
  if(pumping && millis()-pumpStarted>=PUMP_MS) stopPump();
  if(millis()-sampledAt<1000) return;
  sampledAt=millis(); raw=readSoil();
  bool sensorOK=raw>5 && raw<1018;
  if(!sensorOK) { armed=false; stopPump(); Serial.println("Sensor fault: disarmed. Check sensor connection."); }
  if(calibrated()) moisture=constrain(map(raw,calibration.dry,calibration.wet,0,100),0,100);
  Serial.print("Raw: "); Serial.print(raw); Serial.print("  Relative moisture: ");
  if(calibrated()) Serial.print(moisture); else Serial.print("uncalibrated");
  Serial.print("  Armed: "); Serial.print(armed); Serial.print("  Pump: "); Serial.println(pumping);
  if(armed && sensorOK && !pumping && moisture<30 && millis()-lastWatered>=REST_MS) {
    pumpStarted=millis(); pumping=true; digitalWrite(RELAY,LOW);
  }
}
`;

const REACTION_CODE = `// Quickdraw — classic Arduino Nano. No external libraries.
// Button A=D2, B=GND (internal pull-up); LED=D6 through 220 ohms;
// passive piezo PLUS=D9, MINUS=GND. Serial Monitor: 115200 baud.
const uint8_t BUTTON=2, LED=6, BUZZER=9;
enum State { IDLE, WAITING, GO, RESULT };
State state=IDLE;
uint32_t goAt=0, litAt=0, resultAt=0, changedAt=0;
uint32_t best=0;
bool lastRaw=HIGH, stable=HIGH;
void result(const char* message) {
  digitalWrite(LED,LOW); tone(BUZZER,180,180);
  Serial.println(message); state=RESULT; resultAt=millis();
}
void setup() {
  pinMode(BUTTON,INPUT_PULLUP); pinMode(LED,OUTPUT); pinMode(BUZZER,OUTPUT);
  digitalWrite(LED,LOW); Serial.begin(115200); randomSeed(analogRead(A3));
  Serial.println("QUICKDRAW: Press and release to start. Wait for the LED, then press again!");
}
void loop() {
  uint32_t now=millis();
  bool raw=digitalRead(BUTTON), pressed=false;
  if(raw!=lastRaw) { lastRaw=raw; changedAt=now; }
  if(now-changedAt>=20 && raw!=stable) { stable=raw; pressed=(stable==LOW); }
  if(state==IDLE && pressed) {
    goAt=now+random(2000,5001); state=WAITING;
    Serial.println("Ready... release the button and wait for the light.");
  } else if(state==WAITING) {
    if(pressed) result("Too early! Wait for the LED next round.");
    else if((int32_t)(now-goAt)>=0) {
      if(raw==LOW) result("Release the button between presses.");
      else { digitalWrite(LED,HIGH); litAt=now; state=GO; Serial.println("GO!"); }
    }
  } else if(state==GO) {
    if(pressed) {
      if ((int32_t)(changedAt-litAt)<0) { result("Too early! Wait for the LED next round."); return; }
      uint32_t reaction=changedAt-litAt; // Estimate removes the fixed 20ms debounce delay.
      digitalWrite(LED,LOW); tone(BUZZER,1200,90);
      if(best==0 || reaction<best) best=reaction;
      Serial.print("Reaction: "); Serial.print(reaction); Serial.print(" ms. Best: "); Serial.print(best); Serial.println(" ms.");
      state=RESULT; resultAt=now;
    } else if(now-litAt>10000) result("Timed out. Try another round.");
  } else if(state==RESULT && now-resultAt>1200 && stable==HIGH) {
    state=IDLE; Serial.println("Press to start another round.");
  }
}
`;

function heartRate():Project {
  const connections:Connection[]=[
    wire('sensor-gnd','mcu','GND','sensor','GND','ground','Shared 0 V reference for pulse measurements'),
    wire('display-gnd','mcu','GND','display','GND','ground','Shared ground for the OLED'),
    wire('sensor-power','mcu','3V3','sensor','VIN','power','3.3 V supply to the regulated sensor breakout'),
    wire('display-power','mcu','3V3','display','VCC','power','3.3 V supply for the OLED and its I²C pull-ups'),
    wire('sensor-sda','mcu','GPIO21','sensor','SDA','data','I²C pulse measurements on address 0x57','blue','both'),
    wire('sensor-scl','mcu','GPIO22','sensor','SCL','data','I²C clock for the pulse sensor','yellow'),
    wire('display-sda','mcu','GPIO21','display','SDA','data','Shared I²C data bus to OLED address 0x3C','blue','both'),
    wire('display-scl','mcu','GPIO22','display','SCL','data','Shared I²C clock for the OLED','yellow'),
    wire('usb-power','usb','USB','mcu','USB','power','USB bundles 5 V, ground and programming data'),
  ];
  return { id:'heart-rate',name:'Pulse Pal',prompt:'Make me a heart rate tracker',description:'A tiny desktop pulse tracker that turns reflected infrared light into a live heart-rate estimate on an OLED. Rest a finger on the sensor and watch your pulse appear.',howItWorks:'The MAX30102 shines red and infrared light into a fingertip and measures the reflected light. The ESP32 reads the sensor over a 3.3 V I²C bus and looks for repeating pulse peaks. It averages recent valid intervals and sends a pulse estimate to the OLED and Serial Monitor. Motion and poor finger contact affect the reading; this learning prototype does not measure medical-grade heart rate or oxygen saturation.',difficulty:2,buildTimeMinutes:35,skillLevel:'beginner',parts:[...baseParts(),instance('mcu','esp32-devkit','U1','Reads the optical sensor and updates the OLED over a shared 3.3 V I²C bus.',[-21,25,-2],2,'This original ESP32 board uses GPIO21 for SDA and GPIO22 for SCL. GPIO is not 5 V tolerant.'),instance('sensor','max30102','U2','Measures the reflected infrared signal from your fingertip.',[24,27,19],3,'Use the specified regulated 3.3 V breakout. Keep the sensor face accessible and still; this is not a medical device.'),instance('display','ssd1306-oled','DS1','Displays measured pulse estimates and finger-contact status.',[23,39,-15],4,'Match the silkscreen pin order. The displayed values are computed from the real sensor, not a preset number.')],connections,buildSteps:[...startSteps('ESP32',['sensor','display'],'Place the pulse sensor with its optical window facing up. Position the OLED where it will be visible. Use modules with factory-fitted headers.'),step(4,'Connect the shared grounds','With USB disconnected, connect the ESP32 GND pin to sensor GND and OLED GND. These black leads provide the common electrical reference.',['sensor','display'],['sensor-gnd','display-gnd']),step(5,'Route the 3.3 V supply','Connect ESP32 3V3 to sensor VIN and OLED VCC using the red leads. These wires are still unpowered because USB remains unplugged. Never substitute the ESP32 5V pin.',['sensor','display'],['sensor-power','display-power']),step(6,'Wire the pulse sensor bus','Connect GPIO21 to sensor SDA and GPIO22 to sensor SCL. Blue is data and yellow is clock. Leave the optional interrupt pin unconnected.',['sensor'],['sensor-sda','sensor-scl'],'The selected sensor breakout must include the regulators and I²C pull-ups described in its part card.'),step(7,'Add the display to the same bus','Connect GPIO21 to OLED SDA and GPIO22 to OLED SCL. Sharing these two lines works because the sensor and display have different I²C addresses. Inspect every connection before adding power.',['display'],['display-sda','display-scl'],undefined,'Sensor address is 0x57; OLED is usually 0x3C. Check your display variant.'),...endSteps('Install the listed libraries and the Espressif ESP32 board package. Upload the sketch using ESP32 Dev Module. Rest a finger gently on the sensor, hold still for several beats, and compare the OLED output with Serial Monitor.')],code:{language:'arduino',filename:'pulse_pal.ino',source:HEART_CODE,libraries:['SparkFun MAX3010x Pulse and Proximity Sensor Library','Adafruit SSD1306','Adafruit GFX Library']},heroImagePrompt:'Clean industrial design photograph of a small cream desktop pulse tracker with a blue monochrome OLED and a visible optical finger sensor, isolated on off-white.'};
}

function weatherStation():Project {
  const connections=[
    wire('sensor-gnd','mcu','GND','sensor','GND','ground','Common reference for temperature/humidity data'),
    wire('display-gnd','mcu','GND','display','GND','ground','Common ground for OLED'),
    wire('sensor-power','mcu','3V3','sensor','VCC','power','3.3 V power for DHT22'),
    wire('display-power','mcu','3V3','display','VCC','power','3.3 V power for OLED'),
    wire('pullup-power','mcu','3V3','pullup','A','power','Pull-up supply, through 10 kΩ to DATA'),
    wire('sensor-data','mcu','GPIO27','sensor','DATA','signal','Bidirectional DHT22 single-wire readings','green','both'),
    wire('pullup-data','pullup','B','sensor','DATA','signal','10 kΩ pull-up holds the DHT data line high','white','both'),
    wire('display-sda','mcu','GPIO21','display','SDA','data','OLED I²C data at address 0x3C','blue','both'),
    wire('display-scl','mcu','GPIO22','display','SCL','data','OLED I²C clock','yellow'),
    wire('usb-power','usb','USB','mcu','USB','power','USB programming and power, including ground'),
  ];
  return {id:'weather-station',name:'Pocket Forecast',prompt:'Make me a pocket weather station',description:'A compact indoor temperature and humidity monitor with a crisp OLED readout. It samples the air every 2.5 seconds and mirrors the readings to your computer.',howItWorks:'The DHT22 digitizes temperature and relative humidity near the device. A 10 kΩ pull-up keeps its single-wire data line at a stable 3.3 V between messages. The ESP32 requests readings on GPIO27 and writes them to the SSD1306 over I²C. The enclosure needs ventilation, and the sensor should sit away from the controller to reduce heat bias. This measures local conditions; it does not predict tomorrow’s weather.',difficulty:2,buildTimeMinutes:30,skillLevel:'beginner',parts:[...baseParts(),instance('mcu','esp32-devkit','U1','Requests climate readings and formats the display.',[-21,25,-2],2),instance('sensor','dht22','U2','Measures the surrounding air temperature and relative humidity.',[30,28,19],3,'Bare DHT22 pin 3 is not connected. Wait at least 2 seconds between samples; keep ventilation clear.'),instance('pullup','resistor-10k','R1','Holds the DHT DATA line high through 10 kΩ.',[8,26,19],3,'Connect the pull-up to 3.3 V, not 5 V, so ESP32 data stays safe.'),instance('display','ssd1306-oled','DS1','Shows live Celsius temperature and percent relative humidity.',[24,39,-15],4)],connections,buildSteps:[...startSteps('ESP32',['sensor','pullup','display'],'Place the DHT22, 10 kΩ resistor and OLED in separate breadboard rows. Keep the DHT22 away from the controller and exposed to the air. Check the 4-pin DHT22 pin order before inserting it.'),step(4,'Connect both ground wires','Connect controller GND to DHT22 GND and OLED GND. Keep the USB cable disconnected. Leave DHT22 pin 3 unused.',['sensor','display'],['sensor-gnd','display-gnd']),step(5,'Connect the 3.3 V rail and pull-up','Connect 3V3 to DHT VCC and OLED VCC. Connect one end of the 10 kΩ resistor to 3V3. The controller remains unplugged.',['sensor','display','pullup'],['sensor-power','display-power','pullup-power']),step(6,'Connect the temperature sensor data','Connect GPIO27 to DHT DATA. Connect the resistor’s other end to that same DATA row, creating the required 10 kΩ pull-up.',['sensor','pullup'],['sensor-data','pullup-data'],'If a particular DHT22 is unreliable at 3.3 V, use a verified 3.3 V compatible sensor; do not move its pull-up to 5 V.'),step(7,'Connect the OLED data bus','Connect GPIO21 to SDA and GPIO22 to SCL. Inspect the 3.3 V rail, ground rail and resistor placement.',['display'],['display-sda','display-scl']),...endSteps('Install the listed libraries and select ESP32 Dev Module. Upload, then wait 2.5 seconds for the first real sensor reading. Check that Serial and the OLED agree, and leave ventilation around the DHT22.')],code:{language:'arduino',filename:'pocket_forecast.ino',source:WEATHER_CODE,libraries:['DHT sensor library by Adafruit','Adafruit Unified Sensor','Adafruit SSD1306','Adafruit GFX Library']}};
}

function reactionGame():Project {
  const connections=[
    wire('button-gnd','mcu','GND','button','B','ground','Pull the input low when the button is pressed'),
    wire('led-gnd','mcu','GND','led','CATHODE','ground','LED current returns through the cathode'),
    wire('buzzer-gnd','mcu','GND','buzzer','MINUS','ground','Ground reference for the passive piezo'),
    wire('led-drive','mcu','D6','resistor','A','signal','Drives the LED through its current-limiting resistor','orange'),
    wire('led-anode','resistor','B','led','ANODE','signal','Limits LED current to roughly 14 mA','red'),
    wire('button-data','button','A','mcu','D2','signal','Button state with INPUT_PULLUP enabled','blue','both'),
    wire('buzzer-drive','mcu','D9','buzzer','PLUS','signal','Audio waveform from tone()','yellow'),
    wire('usb-power','usb','USB','mcu','USB','power','USB supplies programming data and power with ground'),
  ];
  return {id:'reaction-game',name:'Quickdraw',prompt:'Make me a reaction-time game',description:'A one-button reflex game that makes you wait for an unpredictable light, then measures your response. It catches false starts, gives sound feedback and remembers the best score until reset.',howItWorks:'The Nano reads a button using its internal pull-up resistor. It waits a random 2–5 seconds, lights the LED through a 220 Ω resistor, then times the next button press. A short debounce filter rejects switch chatter and the code compensates for that fixed delay. A passive piezo provides feedback while Serial Monitor displays reaction times. This is a hobby timing game with switch and firmware latency, not a calibrated scientific instrument.',difficulty:1,buildTimeMinutes:20,skillLevel:'beginner',parts:[...baseParts(),instance('mcu','arduino-nano','U1','Runs the timing state machine and reports scores over USB.',[-21,25,-2],2),instance('button','push-button','SW1','Starts each round and records your reaction press.',[26,30,17],3,'A and B are opposite contacts. Place the button across the breadboard centre gap.'),instance('led','led-red','D1','Lights up at the exact start of the reaction interval.',[29,37,-17],4,'Cathode is the short leg/flat edge. Never omit the series resistor.'),instance('resistor','resistor-220','R1','Limits LED current from the 5 V Nano GPIO.',[11,26,-13],3),instance('buzzer','piezo-buzzer','BZ1','Plays a short tone for a result or false start.',[28,27,0],3,'Use a passive low-current piezo transducer, not a magnetic buzzer.')],connections,buildSteps:[...startSteps('Arduino Nano',['button','led','resistor','buzzer'],'Insert the button across the breadboard centre gap. Put the LED, its 220 Ω resistor and passive piezo in separate rows. Keep the LED’s long anode lead identifiable.'),step(4,'Connect ground returns','Connect Nano GND to button B, LED CATHODE and piezo MINUS. The board must still be unplugged. The button uses an internal pull-up, so it needs no power wire.',['button','led','buzzer'],['button-gnd','led-gnd','buzzer-gnd']),step(5,'Connect the current-limited LED','Connect D6 to one end of the 220 Ω resistor. Connect the other end to LED ANODE. Check that the LED’s two leads are in separate rows.',['led','resistor'],['led-drive','led-anode']),step(6,'Connect the button and sound','Connect button A to D2 and piezo PLUS to D9. The sketch enables INPUT_PULLUP on D2, so pressing the button sends a LOW reading.',['button','buzzer'],['button-data','buzzer-drive']),step(7,'Inspect the unpowered circuit','Trace D6 through the resistor to the LED, and check all three black ground leads. Press the button to confirm it is seated firmly. Keep USB unplugged until this inspection is complete.',[],[],undefined,'There must be a resistor in series with the LED. No GPIO should be directly shorted to ground.'),...endSteps('Select Arduino Nano and ATmega328P in the Arduino AVR Boards package, then upload. Open Serial Monitor at 115200 baud. Press and release to start, wait for the LED, and press again to see your measured reaction time.')],code:{language:'arduino',filename:'quickdraw.ino',source:REACTION_CODE,libraries:[]}};
}

function plantWaterer():Project {
  const connections=[
    wire('sensor-gnd','mcu','GND','sensor','GND','ground','Common reference for the soil probe'),
    wire('relay-gnd','mcu','GND','relay','GND','ground','Shared reference for relay control'),
    wire('diode-ground','diode','ANODE','pump','MINUS','ground','Flyback diode anode at the negative motor terminal'),
    wire('sensor-power','mcu','5V','sensor','VCC','power','Powers the regulated soil sensor from the controller rail'),
    wire('relay-power','mcu','5V','relay','VCC','power','Powers the relay module driver and coil, not the pump'),
    wire('relay-pullup-power','mcu','5V','pullup','A','power','Holds active-LOW relay input off while GPIO starts'),
    wire('pump-positive','relay','NO','pump','PLUS','power','Normally-open contact sends motor power only when enabled'),
    wire('diode-positive','pump','PLUS','diode','CATHODE','power','Striped diode end goes to motor positive'),
    wire('soil-data','sensor','AOUT','mcu','A0','signal','Reads the 0–3 V soil moisture signal','green'),
    wire('relay-data','mcu','D7','relay','IN','signal','LOW energizes this specific relay module','yellow'),
    wire('relay-pullup-data','pullup','B','relay','IN','signal','10 kΩ pull-up keeps relay off during reset','white'),
    wire('supply-positive','motorSupply','PLUS','relay','COM','power','Separate 5 V source feeds the relay common contact'),
    wire('supply-ground','motorSupply','MINUS','pump','MINUS','ground','Motor current returns directly to its own supply'),
    wire('supply-reference','motorSupply','MINUS','mcu','GND','ground','Joins signal reference; positive supply rails remain separate'),
    wire('usb-power','usb','USB','mcu','USB','power','USB powers and programs the Nano; it does not supply the pump'),
  ];
  const ending=endSteps('Select classic Arduino Nano / ATmega328P and upload the code. With the pump outlet in a catch container, send d in dry soil and w in wet soil using Serial Monitor; then send a to arm. Watering stays disabled until calibration is valid, starts only after a 30-second settling period, and x stops it immediately.');
  ending[0]=step(8,'Connect USB and the separate pump supply','After checking the diode stripe, relay contacts and all wiring, connect the separate 5 V supply to relay COM and pump MINUS. Join its negative to Nano GND, then plug in Nano USB. Keep the pump outlet in a catch container and the relay inactive.',['usb','motorSupply'],['supply-positive','supply-ground','supply-reference','usb-power'],'Never connect the pump supply positive to Nano 5V. Disconnect both sources before changing any wiring.','Use only a regulated 5 V low-voltage supply with a fitted terminal adapter. Confirm relay NO is open at idle.');
  return {id:'plant-waterer',name:'Little Sprout',prompt:'Make me a smart plant waterer',description:'A calibrated soil monitor that waters in short, spaced bursts when your plant gets dry. A relay keeps the pump load off the controller, and automatic watering starts disarmed.',howItWorks:'The capacitive soil probe produces an analog voltage that the Nano reads on A0. You record dry and wet readings in Serial Monitor to establish relative moisture for your own soil. Once armed, the code switches an active-LOW relay for 1.5 seconds below 30% relative moisture, with at least 30 seconds between bursts. The relay routes a separate 5 V motor supply to the pump, while a flyback diode suppresses its turn-off transient. The moisture scale is a calibrated relative index, not a laboratory soil water percentage; supervise initial tests and keep electronics dry.',difficulty:3,buildTimeMinutes:50,skillLevel:'beginner',parts:[...baseParts(),instance('mcu','arduino-nano','U1','Reads calibrated soil moisture and safely times brief watering bursts.',[-21,25,-2],2),instance('sensor','soil-moisture','U2','Measures moisture around the plant roots.',[60,23,15],3,'Only insert the marked sensing region. Keep the upper electronics and connector dry.'),instance('relay','relay-module','K1','Switches the separate motor supply when its input goes LOW.',[19,29,4],3,'Set the relay trigger jumper to L. This sketch requires an active-LOW 5 V module with a built-in coil driver and flyback diode.'),instance('pump','water-pump','M1','Moves a small amount of water through fitted tubing.',[56,17,-31],2,'Never power the pump from a GPIO or Nano 5V. Use a fitted-lead 5 V pump below 500 mA and keep the control electronics dry.'),instance('diode','diode-1n4007','D1','Clamps the inductive kick from the pump motor.',[37,23,-16],3,'Striped CATHODE goes to pump PLUS; reversing it shorts the motor supply.'),instance('pullup','resistor-10k','R1','Keeps relay IN high and inactive while the Nano resets.',[5,27,-16],3),instance('motorSupply','supply-5v','P2','Supplies motor current separately from the Nano USB rail.',[-60,13,-40],1,'Use the fitted low-voltage terminal adapter. Never handle or expose mains wiring.')],connections,buildSteps:[...startSteps('Arduino Nano',['sensor','relay','pump','diode','pullup'],'Place the soil probe outside the dry electronics case and fit the pump tubing. Position the relay and 10 kΩ resistor on the dry side. Fit the diode across the motor terminals with its striped end at pump PLUS; use fitted leads and screw terminals.'),step(4,'Connect unpowered ground returns','Connect Nano GND to probe GND and relay GND. Connect diode ANODE to pump MINUS. Keep USB and the separate pump supply unplugged.',['sensor','relay','diode','pump'],['sensor-gnd','relay-gnd','diode-ground']),step(5,'Route the supply and motor conductors','Connect Nano 5V to probe VCC, relay VCC and one end of the 10 kΩ pull-up. Connect relay NO to pump PLUS, and pump PLUS to the striped diode CATHODE. All sources remain disconnected.',['sensor','relay','pump','diode','pullup'],['sensor-power','relay-power','relay-pullup-power','pump-positive','diode-positive'],'The diode belongs across the motor; the relay module’s coil diode does not protect the separate pump motor.'),step(6,'Connect sensing and relay control','Connect probe AOUT to A0 and Nano D7 to relay IN. Connect the other end of the 10 kΩ pull-up to relay IN. This keeps the relay inactive while the controller starts.',['sensor','relay','pullup'],['soil-data','relay-data','relay-pullup-data']),step(7,'Check the dry plumbing and fail-safe','Keep both supplies unplugged. Verify the diode stripe faces pump PLUS, set the relay trigger jumper to L, and use NO instead of NC. Fit the intake and outlet securely and route all water away from the case.',[],[],'Use a fitted cable or screw-terminal adapter for the pump. Never push high-current motor leads through loose breadboard contacts.','Pump supply PLUS must have no direct path to Nano 5V. The pump should be off with relay IN high.'),...ending],code:{language:'arduino',filename:'little_sprout.ino',source:PLANT_CODE,libraries:[]}};
}

export const demoProjects:Project[]=[heartRate(),plantWaterer(),weatherStation(),reactionGame()];
/** Returns independent data: editing or undoing one build cannot mutate a saved demo. */
export function getDemoProject(prompt:string,skillLevel:'beginner'|'intermediate'='beginner'):Project {
  const q=prompt.toLowerCase();
  const id=/plant|soil|water|garden|irrigat/.test(q)?'plant-waterer':/weather|temperature|humid|climate/.test(q)?'weather-station':/reaction|reflex|game|button/.test(q)?'reaction-game':'heart-rate';
  const project=structuredClone(demoProjects.find(p=>p.id===id)!);
  project.skillLevel=skillLevel;
  if(prompt.trim()) project.prompt=prompt.trim();
  return project;
}

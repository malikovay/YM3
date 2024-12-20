/*
Copyright (C): 2024, YM3
*/

let display = 0;

function displayOff(): void {
    if (!display) {
        led.enable(false);
        display = 1;
    }
}

//% color="#cd4896" weight=40 icon="\uf085" //#9a1564
namespace YM3_motor {

    const PCA9685_ADD = 0x40
    const MODE1 = 0x00
    const LED0_ON_L = 0x06
    const PRESCALE = 0xFE

    let initialized = false
    let initializedMotor = false;
    let motorPWM = false;

    let a_ = 10, b_ = 11;
    let t1_ = 0, t2_ = 0, pwm_ = 0, speed_ = 0;

    let initEncoderM1 = false
    let initEncoderM2 = false
    let initEncoderM3 = false

    let encoderM1 = 0
    let encoderM2 = 0
    let encoderM3 = 0

    let encoderM1Time = 0
    let encoderM2Time = 0
    let encoderM3Time = 0

    let initServo4 = 0
    let initServo8 = 0

    let servo4 = 0
    let servo8 = 0

    let invertM1 = 1;
    let invertM2 = 1;
    let invertM3 = 1;

    export enum enServo {
        S4 = 3,
        S8 = 7
    }
    export enum enMotors {
        M1 = 5, //6
        M2 = 2, //4
        M3 = 0  //1
    }
    export enum enMotorsAll {
        M1 = 5,
        M2 = 2,
        M3 = 0,
        //% block="Все"
        M1M2M3 = 1
    }
    export enum enMotorsDual {
        M1M2 = 1,
        M1M3 = 2,
        M2M3 = 3
    }
    export enum enLock {
        //% block="Тормоз"
        Brake = 1,
        //% block="Инерция"
        Coast = 2
    }
    export enum enMode {
        //% block="Обороты"
        Rotations = 1,
        //% block="Градусы"
        Degrees = 2,
        //% block="Сумма"
        Sum = 3
    }

    export enum enMode2 {
        //% block="Обороты"
        Rotations = 1,
        //% block="Градусы"
        Degrees = 2
    }

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2ccmd(addr: number, value: number) {
        let buf = pins.createBuffer(1)
        buf[0] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
        return val;
    }

    function setFreq(freq: number): void {
        // Constrain the frequency
        let prescaleval = 25000000;
        prescaleval /= 4096;
        prescaleval /= freq;
        prescaleval -= 1;
        let prescale = prescaleval; //Math.Floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9685_ADD, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10; // sleep
        i2cwrite(PCA9685_ADD, MODE1, newmode); // go to sleep
        i2cwrite(PCA9685_ADD, PRESCALE, prescale); // set the prescaler
        i2cwrite(PCA9685_ADD, MODE1, oldmode);
        control.waitMicros(5000);
        i2cwrite(PCA9685_ADD, MODE1, oldmode | 0xa1);
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;
        if (!initialized) {
            initPCA9685();
        }
        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
        pins.i2cWriteBuffer(PCA9685_ADD, buf);
    }

    function initPCA9685(): void {
        i2cwrite(PCA9685_ADD, MODE1, 0x00)
        setFreq(50);
        initialized = true
    }

    function initMotor(): void {
        initializedMotor = true;
        basic.forever(function () {
            if (motorPWM) {
                if (speed_ >= 0) {
                    setPwm(a_, 0, pwm_)
                    setPwm(b_, 0, 0)
                } else {
                    setPwm(a_, 0, 0)
                    setPwm(b_, 0, pwm_)
                }
                basic.pause(t1_);
                setPwm(a_, 0, 0)
                setPwm(b_, 0, 0)
                basic.pause(t2_);
            } else {
                basic.pause(200);
            }
        })
    }

    function initEncoder(index: enMotorsAll): void {
        if (index == 1) {
            initEncoder(5);
            initEncoder(2);
            initEncoder(0);
        }
        else if (index == 5) {
            if (!initEncoderM1) {
                initEncoderM1 = true;
                pins.onPulsed(DigitalPin.P13, PulseValue.High, function () {
                    //if (control.micros() - encoderM1Time > 1500) {
                        //encoderM1Time = control.micros();
                        if (pins.digitalReadPin(DigitalPin.P14))
                            encoderM1 += 2;
                        else
                            encoderM1 -= 2;
                    //}
                });
            }
        }
        else if (index == 2) {
            if (!initEncoderM2) {
                initEncoderM2 = true;
                displayOff();
                pins.onPulsed(DigitalPin.P7, PulseValue.High, function () {
                    //if (control.micros() - encoderM2Time > 1500) {
                        //encoderM2Time = control.micros();
                        if (pins.digitalReadPin(DigitalPin.P8))
                            encoderM2 += 2;
                        else
                            encoderM2 -= 2;
                    //}
                });
            }
        }
        else {
            if (!initEncoderM3) {
                initEncoderM3 = true;
                displayOff();
                pins.onPulsed(DigitalPin.P10, PulseValue.High, function () {
                    //if (control.micros() - encoderM3Time > 1500) {
                        //encoderM3Time = control.micros();
                        if (pins.digitalReadPin(DigitalPin.P9))
                            encoderM3 += 2;
                        else
                            encoderM3 -= 2;
                    //}
                });
            }
        }
    }

    //% block="Сервомотор %num|%angle\\°" blockGap=8
    //% weight=100
    //% angle.min=0 angle.max=360
    // color=#127826
    export function Servo(index: enServo, angle: number): void {
        // 50hz: 20,000 us
        if (angle < 0) angle = 0;
        if (angle > 360) angle = 360;

        let us = Math.map(angle, 0, 360, 550, 2950); //550 - 0, 2950 - 360, 2400 - 270
        let pwm = us * 4096 / 20000;
        setPwm(index, 0, pwm);

        //требуется задержка на время пока сервомотор повернется в нужный угол
        let y;
        if (index == 3) y = servo4;
        else y = servo8;
        let x = Math.abs(angle - y) * 4;
        
        if (index == 3) {
            if (!initServo4) {
                initServo4 = 1;
                x = 360 * 4;
            }
        } else {
            if (!initServo8) {
                initServo8 = 1;
                x = 360 * 4;
            }
        }

        basic.pause(x); //пауза пропорциональна разнице прошлого угла и текущего
        if (index == 3) servo4 = angle;
        else servo8 = angle;
    }

    //% block="Мотор по мощности %index|%speed\\%" blockGap=8
    //% weight=99
    //% group="Мотор"
    //% speed.min=-100 speed.max=100 speed.defl=75 speed.shadow="speedPicker"
    //% inlineInputMode=inline
    export function MotorRun(index: enMotorsAll, speed: number): void {
        if (index == 1) {
            MotorRun(5, speed);
            MotorRun(2, speed);
            MotorRun(0, speed);
            return;
        }

        if (!initialized)
            initPCA9685();
        if (!initializedMotor)
            initMotor();

        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        if (index == 5) {
            speed *= invertM1;
            a_ = 6, b_ = 5;
        } else if (index == 2) {
            speed *= invertM2;
            a_ = 4, b_ = 2;
        } else {
            speed *= invertM3;
            a_ = 1, b_ = 0;
        }

        if (Math.abs(speed) <= 41 && speed != 0) {
            if (Math.abs(speed) >= 2 && Math.abs(speed) <= 4)
                t1_ = 40, t2_ = 960, pwm_ = 1700 + 300 * (Math.abs(speed)-1);
            else if (Math.abs(speed) == 5)
                t1_ = 40, t2_ = 960, pwm_ = 3100;
            else if (Math.abs(speed) >= 6 && Math.abs(speed) <= 10)
                t1_ = 20, t2_ = 80, pwm_ = 1300 + 25 * (Math.abs(speed) - 6);
            else
                t1_ = 20, t2_ = 80, pwm_ = 1400 + 46.667 * (Math.abs(speed) - 10);

            speed_ = speed;
            motorPWM = true;
        } else {
            motorPWM = false;
            if (speed > 0) speed = Math.map(speed, 42, 100, 850, 4095); //устраняется мертвая зона мотора около 0
            else if (speed < 0) speed = Math.map(speed, -42, -100, -850, -4095);

            if (speed > 4095) speed = 4095;
            if (speed < -4095) speed = -4095;

            if (speed >= 0) {
                setPwm(a_, 0, speed)
                setPwm(b_, 0, 0)
            } else {
                setPwm(a_, 0, 0)
                setPwm(b_, 0, -speed)
            }
        }
    }

    //% block="Мотор по времени %index|%speed\\%|%time\\c|%lock" blockGap=8
    //% weight=98
    //% group="Мотор"
    //% speed.min=-100 speed.max=100 speed.defl=75 speed.shadow="speedPicker"
    //% time.defl=1
    //% inlineInputMode=inline
    export function MotorRunTime(index: enMotorsAll, speed: number, time: number, lock: enLock): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        MotorRun(index, speed);
        basic.pause(Math.abs(time) * 1000);
        if (lock == 1) MotorLock(index, 1);
        else MotorRun(index, 0);
    }

    //% block="Мотор по энкодеру %index|%speed\\%|%rotations\\↻|%degrees\\°|%mode|%lock" blockGap=8
    //% weight=97
    //% group="Мотор"
    //% speed.min=-100 speed.max=100 speed.defl=75 speed.shadow="speedPicker"
    //% rotations.defl=1 degrees.defl=360
    //% inlineInputMode=inline
    export function MotorRunRD(index: enMotors, speed: number, rotations: number, degrees: number, mode: enMode, lock: enLock): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        let enc = 0;

        encoderM1 = 0; // если нужно непрерывно считать энкодеры, то это закомментировать
        encoderM2 = 0;
        encoderM3 = 0;

        let motor;
        if (index == 5) motor = 5;
        else if (index == 2) motor = 2;
        else motor = 0;

        if (mode == 1) {
            enc += Math.abs(rotations) * 360;
        }
        else if (mode == 2) {
            enc += Math.abs(degrees);
        }
        else if (mode == 3) {
            enc += Math.abs(rotations) * 360 + Math.abs(degrees);
        }

        initEncoder(motor);

        MotorRun(motor, speed);

        let k = 1;
        if (Math.abs(speed) >= 20 && Math.abs(speed) <= 42)
            k = 2;
        else if (Math.abs(speed) <= 19)
            k = 4;

        if (index == 5) {
            if (speed < 0) {
                enc *= -1;
                enc += encoderM1;
                while (enc < (encoderM1 + speed / k)) { basic.pause(5); }
            }
            else {
                enc += encoderM1;
                while (enc > (encoderM1 + speed / k)) { basic.pause(5); }
            }
        }
        else if (index == 2) {
            if (speed < 0) {
                enc *= -1;
                enc += encoderM2;
                while (enc < (encoderM2 + speed / k)) { basic.pause(5); }
            }
            else {
                enc += encoderM2;
                while (enc > (encoderM2 + speed / k)) { basic.pause(5); }
            }
        }
        else {
            if (speed < 0) {
                enc *= -1;
                enc += encoderM3;
                while (enc < (encoderM3 + speed / k)) { basic.pause(5); }
            }
            else {
                enc += encoderM3;
                while (enc > (encoderM3 + speed / k)) { basic.pause(5); }
            }
        }

        encoderOff(motor); // если нужно непрерывно считать энкодеры, то это закомментировать

        if (lock == 1) MotorLock(motor, 1);
        else MotorRun(motor, 0);
    }

    //% block="Инвертирование мотора %index" blockGap=8
    //% weight=96
    //% group="Мотор"
    export function MotorInvert(index: enMotorsAll): void {
        if (index == 1) {
            invertM1 *= -1;
            invertM2 *= -1;
            invertM3 *= -1;
        }
        else if (index == 5)
            invertM1 *= -1;
        else if (index == 2)
            invertM2 *= -1;
        else
            invertM3 *= -1;
    }

    //% block="Рулевое управление по мощности %motor|%steer\\↑|%speed\\%" blockGap=8
    //% weight=92
    //% steer.shadow=speedPicker steer.min=-100 steer.max=100 steer.defl=0
    //% speed.shadow=speedPicker speed.min=-100 speed.max=100 speed.defl=75
    //% inlineInputMode=inline
    //% group="Рулевое управление моторами"
    export function MotorRunSteer(motor: enMotorsDual, steer: number, speed: number): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        if (steer > 100) steer = 100;
        if (steer < -100) steer = -100;

        let motor1;
        let motor2;

        if (motor == 1) {
            motor1 = 5;
            motor2 = 2;
        } else if (motor == 2) {
            motor1 = 5;
            motor2 = 0;
        } else {
            motor1 = 2;
            motor2 = 0;
        }
        if (steer >= 0) {
            MotorRun(motor1, speed);
            if (speed >= 0)
                MotorRun(motor2, speed - steer * 2);
            else
                MotorRun(motor2, speed + steer * 2);
        } else {
            MotorRun(motor2, speed);
            if (speed >= 0)
                MotorRun(motor1, speed + steer * 2);
            else
                MotorRun(motor1, speed - steer * 2);
        }
    }

    //% block="Рулевое управление по времени %motor|%steer\\↑|%speed\\%|%time\\c|%lock" blockGap=8
    //% weight=91
    //% steer.shadow=speedPicker steer.min=-100 steer.max=100 steer.defl=0
    //% speed.shadow=speedPicker speed.min=-100 speed.max=100 speed.defl=75
    //% time.defl=1
    //% inlineInputMode=inline
    //% group="Рулевое управление моторами"
    export function MotorRunSteerTime(motor: enMotorsDual, steer: number, speed: number, time: number, lock: enLock): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        if (steer > 100) steer = 100;
        if (steer < -100) steer = -100;

        let motor1;
        let motor2;

        if (motor == 1) {
            motor1 = 5;
            motor2 = 2;
        } else if (motor == 2) {
            motor1 = 5;
            motor2 = 0;
        } else {
            motor1 = 2;
            motor2 = 0;
        }
        if (steer >= 0) {
            MotorRun(motor1, speed);
            if (speed >= 0)
                MotorRun(motor2, speed - steer * 2);
            else
                MotorRun(motor2, speed + steer * 2);
        } else {
            MotorRun(motor2, speed);
            if (speed >= 0)
                MotorRun(motor1, speed + steer * 2);
            else
                MotorRun(motor1, speed - steer * 2);
        }

        basic.pause(Math.abs(time) * 1000);

        if (lock == 1) MotorLockDual(motor, 1);
        else MotorLockDual(motor, 0);
    }

    //% block="Рулевое управление по энкодеру %motor|%steer\\↑|%speed\\%|%rotations\\↻|%degrees\\°|%mode|%lock" blockGap=8
    //% weight=90
    //% steer.shadow=speedPicker steer.min=-100 steer.max=100 steer.defl=0
    //% speed.shadow=speedPicker speed.min=-100 speed.max=100 speed.defl=75
    //% rotations.defl=1 degrees.defl=360
    //% inlineInputMode=inline
    //% group="Рулевое управление моторами"
    export function MotorRunSteerRD(motor: enMotorsDual, steer: number, speed: number, rotations: number, degrees: number, mode: enMode, lock: enLock): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        if (steer > 100) steer = 100;
        if (steer < -100) steer = -100;

        let motor1
        let motor2

        if (motor == 1) {
            motor1 = 5;
            motor2 = 2;
        } else if (motor == 2) {
            motor1 = 5;
            motor2 = 0;
        } else {
            motor1 = 2;
            motor2 = 0;
        }

        let enc = 0;

        let steer_ = 0;

        encoderM1 = 0; // если нужно непрерывно считать энкодеры, то это закомментировать
        encoderM2 = 0;
        encoderM3 = 0;

        if (mode == 1) {
            enc += Math.abs(rotations) * 360;
        }
        else if (mode == 2) {
            enc += Math.abs(degrees);
        }
        else if (mode == 3) {
            enc += Math.abs(rotations) * 360 + Math.abs(degrees);
        }

        let k = 1;
        if (Math.abs(speed) >= 20 && Math.abs(speed) <= 42)
            k = 2;
        else if (Math.abs(speed) <= 19)
            k = 4;

        if (steer >= 0) {
            initEncoder(motor1);
            MotorRun(motor1, speed);
            if (speed >= 0)
                MotorRun(motor2, speed - steer * 2);
            else
                MotorRun(motor2, speed + steer * 2);
            if (motor1 == 5) {
                if (speed < 0) {
                    enc *= -1;
                    enc += encoderM1;
                    while (enc < (encoderM1 + speed / k)) { basic.pause(5); }
                }
                else {
                    enc += encoderM1;
                    while (enc > (encoderM1 + speed / k)) { basic.pause(5); }
                }
            } else if (motor1 == 2) {
                if (speed < 0) {
                    enc *= -1;
                    enc += encoderM2;
                    while (enc < (encoderM2 + speed / k)) { basic.pause(5); }
                }
                else {
                    enc += encoderM2;
                    while (enc > (encoderM2 + speed / k)) { basic.pause(5); }
                }
            }
            encoderOff(motor1); // если нужно непрерывно считать энкодеры, то это закомментировать
        } else if (steer < 0) {
            initEncoder(motor2);
            MotorRun(motor2, speed);
            if (speed >= 0)
                MotorRun(motor1, speed + steer * 2);
            else
                MotorRun(motor1, speed - steer * 2);
            if (motor2 == 2) {
                if (speed < 0) {
                    enc *= -1;
                    enc += encoderM2;
                    while (enc < (encoderM2 + speed / k)) { basic.pause(5); }
                }
                else {
                    enc += encoderM2;
                    while (enc > (encoderM2 + speed / k)) { basic.pause(5); }
                }
            } else if (motor2 == 0) {
                if (speed < 0) {
                    enc *= -1;
                    enc += encoderM3;
                    while (enc < (encoderM3 + speed / k)) { basic.pause(5); }
                }
                else {
                    enc += encoderM3;
                    while (enc > (encoderM3 + speed / k)) { basic.pause(5); }
                }
            }
            encoderOff(motor2); // если нужно непрерывно считать энкодеры, то это закомментировать
        } 
        /*else {
            initEncoder(motor1);
            initEncoder(motor2);
            MotorRun(motor1, speed);
            MotorRun(motor2, speed);

            if (speed < 0) {
                enc *= -1;
                enc += encoderM1;
                while (enc < (encoderM1 + speed / 4)) {
                    steer_ = encoderM1 - encoderM2;
                    if (steer_ < 0) {
                        MotorRun(motor2, speed - steer_ * 1);
                        MotorRun(motor1, speed);
                    }
                    else {
                        MotorRun(motor1, speed + steer_ * 1);
                        MotorRun(motor2, speed);
                    }
                    basic.pause(5);
                }
            }
            else {
                enc += encoderM1;
                while (enc > (encoderM1 + speed / 4)) {
                    steer_ = encoderM1 - encoderM2;
                    if (steer_ < 0) {
                        MotorRun(motor2, speed + steer_ * 2);
                        MotorRun(motor1, speed);
                    }
                    else {
                        MotorRun(motor1, speed - steer_ * 2);
                        MotorRun(motor2, speed);
                    }

                    YM3_I2C.showNumber(steer_);
                    basic.pause(5);
                }
            }
            encoderOff(motor1); // если нужно непрерывно считать энкодеры, то это закомментировать
            encoderOff(motor2);
        }
        */

        if (lock == 1) MotorLockDual(motor, 1);
        else MotorLockDual(motor, 0);
    }

    //% block="Танковое управление по мощности %motor|%speed1\\%|%speed2\\%" blockGap=8
    //% weight=89
    //% speed1.shadow=speedPicker speed1.min=-100 speed1.max=100 speed1.defl=75
    //% speed2.shadow=speedPicker speed2.min=-100 speed2.max=100 speed2.defl=75
    //% inlineInputMode=inline
    //% group="Танковое управление моторами"
    export function MotorRunTank(motor: enMotorsDual, speed1: number, speed2: number): void {
        if (speed1 > 100) speed1 = 100;
        if (speed1 < -100) speed1 = -100;

        if (speed2 > 100) speed2 = 100;
        if (speed2 < -100) speed2 = -100;

        let motor1;
        let motor2;

        if (motor == 1) {
            motor1 = 5;
            motor2 = 2;
        } else if (motor == 2) {
            motor1 = 5;
            motor2 = 0;
        } else {
            motor1 = 2;
            motor2 = 0;
        }

        MotorRun(motor1, speed1);
        MotorRun(motor2, speed2);
    }

    //% block="Танковое управление по времени %motor|%speed1\\%|%speed2\\%|%time\\c|%lock" blockGap=8
    //% weight=88
    //% speed1.shadow=speedPicker speed1.min=-100 speed1.max=100 speed1.defl=75
    //% speed2.shadow=speedPicker speed2.min=-100 speed2.max=100 speed2.defl=75
    //% time.defl=1
    //% inlineInputMode=inline
    //% group="Танковое управление моторами"
    export function MotorRunTankTime(motor: enMotorsDual, speed1: number, speed2: number, time: number, lock: enLock): void {
        if (speed1 > 100) speed1 = 100;
        if (speed1 < -100) speed1 = -100;

        if (speed2 > 100) speed2 = 100;
        if (speed2 < -100) speed2 = -100;

        let motor1;
        let motor2;

        if (motor == 1) {
            motor1 = 5;
            motor2 = 2;
        } else if (motor == 2) {
            motor1 = 5;
            motor2 = 0;
        } else {
            motor1 = 2;
            motor2 = 0;
        }

        MotorRun(motor1, speed1);
        MotorRun(motor2, speed2);

        basic.pause(Math.abs(time) * 1000);

        if (lock == 1) MotorLockDual(motor, 1);
        else MotorLockDual(motor, 0);
    }

    //% block="Танковое управление по энкодеру %motor|%speed1\\%|%speed2\\%|%rotations\\↻|%degrees\\°|%mode|%lock" blockGap=8
    //% weight=87
    //% speed1.shadow=speedPicker speed1.min=-100 speed1.max=100 speed1.defl=75
    //% speed2.shadow=speedPicker speed2.min=-100 speed2.max=100 speed2.defl=75
    //% rotations.defl=1 degrees.defl=360
    //% inlineInputMode=inline
    //% group="Танковое управление моторами"
    export function MotorRunTankRD(motor: enMotorsDual, speed1: number, speed2: number, rotations: number, degrees: number, mode: enMode, lock: enLock): void {
        if (speed1 > 100) speed1 = 100;
        if (speed1 < -100) speed1 = -100;

        if (speed2 > 100) speed2 = 100;
        if (speed2 < -100) speed2 = -100;

        let motor1;
        let motor2;

        if (motor == 1) {
            motor1 = 5;
            motor2 = 2;
        } else if (motor == 2) {
            motor1 = 5;
            motor2 = 0;
        } else {
            motor1 = 2;
            motor2 = 0;
        }

        let enc = 0;

        encoderM1 = 0; // если нужно непрерывно считать энкодеры, то это закомментировать
        encoderM2 = 0;
        encoderM3 = 0;

        if (mode == 1) {
            enc += Math.abs(rotations) * 360;
        }
        else if (mode == 2) {
            enc += Math.abs(degrees);
        }
        else if (mode == 3) {
            enc += Math.abs(rotations) * 360 + Math.abs(degrees);
        }

        let k1 = 1;
        if (Math.abs(speed1) >= 20 && Math.abs(speed1) <= 42)
            k1 = 2;
        else if (Math.abs(speed1) <= 19)
            k1 = 4;

        let k2 = 1;
        if (Math.abs(speed2) >= 20 && Math.abs(speed2) <= 42)
            k2 = 2;
        else if (Math.abs(speed2) <= 19)
            k2 = 4;

        if (Math.abs(speed1) >= Math.abs(speed2)) {
            initEncoder(motor1);
            MotorRun(motor1, speed1);
            MotorRun(motor2, speed2);

            if (motor1 == 5) {
                if (speed1 < 0) {
                    enc *= -1;
                    enc += encoderM1;
                    while (enc < (encoderM1 + speed1 / k1)) { basic.pause(5); }
                }
                else {
                    enc += encoderM1;
                    while (enc > (encoderM1 + speed1 / k1)) { basic.pause(5); }
                }
            } else if (motor1 == 2) {
                if (speed1 < 0) {
                    enc *= -1;
                    enc += encoderM2;
                    while (enc < (encoderM2 + speed1 / k1)) { basic.pause(5); }
                }
                else {
                    enc += encoderM2;
                    while (enc > (encoderM2 + speed1 / k1)) { basic.pause(5); }
                }
            }
            encoderOff(motor1); // если нужно непрерывно считать энкодеры, то это закомментировать
        } else {
            initEncoder(motor2);
            MotorRun(motor1, speed1);
            MotorRun(motor2, speed2);

            if (motor2 == 2) {
                if (speed2 < 0) {
                    enc *= -1;
                    enc += encoderM2;
                    while (enc < (encoderM2 + speed2 / k2)) { basic.pause(5); }
                }
                else {
                    enc += encoderM2;
                    while (enc > (encoderM2 + speed2 / k2)) { basic.pause(5); }
                }
            } else if (motor2 == 0) {
                if (speed2 < 0) {
                    enc *= -1;
                    enc += encoderM3;
                    while (enc < (encoderM3 + speed2 / k2)) { basic.pause(5); }
                }
                else {
                    enc += encoderM3;
                    while (enc > (encoderM3 + speed2 / k2)) { basic.pause(5); }
                }
            }
            encoderOff(motor2); // если нужно непрерывно считать энкодеры, то это закомментировать
        }

        if (lock == 1) MotorLockDual(motor, 1);
        else MotorLockDual(motor, 0);
    }

    //% block="Остановка мотора %index|%lock" blockGap=8
    //% weight=85
    //% group="Остановка моторов"
    export function MotorLock(index: enMotorsAll, l: enLock): void {
        if (!initialized) {
            initPCA9685()
        }
        let a = index;
        let b = index + 1;
        if (index == 2) b++;

        motorPWM = false;

        if (l == 1) {
            if (index != 1) {               
                setPwm(a, 0, 4095)
                setPwm(b, 0, 4095)
            } else {
                setPwm(5, 0, 4095)
                setPwm(6, 0, 4095)
                setPwm(2, 0, 4095)
                setPwm(4, 0, 4095)
                setPwm(0, 0, 4095)
                setPwm(1, 0, 4095)
            }
            basic.pause(200)
        }

        if (index != 1) {
            setPwm(a, 0, 0)
            setPwm(b, 0, 0)
        } else {
            setPwm(5, 0, 0)
            setPwm(6, 0, 0)
            setPwm(2, 0, 0)
            setPwm(4, 0, 0)
            setPwm(0, 0, 0)
            setPwm(1, 0, 0)
        }
    }

    //% block="Остановка двух моторов %motor|%lock" blockGap=8
    //% weight=84
    //% group="Остановка моторов"
    //% inlineInputMode=inline
    export function MotorLockDual(motor: enMotorsDual, l: enLock): void {
        if (!initialized) {
            initPCA9685()
        }
        motorPWM = false;

        let motor1_a, motor1_b;
        let motor2_a, motor2_b;
        if (motor == 1) {
            motor1_a = 5; motor1_b = 6;
            motor2_a = 2; motor2_b = 4;
        } else if (motor == 2) {
            motor1_a = 5; motor1_b = 6;
            motor2_a = 0; motor2_b = 1;
        } else {
            motor1_a = 2; motor1_b = 4;
            motor2_a = 0; motor2_b = 1;
        }
        if (l == 1) {
            setPwm(motor1_a, 0, 4095)
            setPwm(motor1_b, 0, 4095)
            setPwm(motor2_a, 0, 4095)
            setPwm(motor2_b, 0, 4095)
            basic.pause(200)
        }

        setPwm(motor1_a, 0, 0)
        setPwm(motor1_b, 0, 0)
        setPwm(motor2_a, 0, 0)
        setPwm(motor2_b, 0, 0)
    }

    //% block="Включение/обнуление энкодера %index" blockGap=8
    //% weight=80
    //% group="Энкодеры"
    // color=#e3b838
    export function zeroEncoder(index: enMotorsAll): void {
        if (index != 1) {
            initEncoder(index);
            if (index == 5) encoderM1 = 0;
            else if (index == 2) encoderM2 = 0;
            else encoderM3 = 0;
        } else {
            initEncoder(5);
            initEncoder(2);
            initEncoder(0);
            encoderM1 = 0;
            encoderM2 = 0;
            encoderM3 = 0;
        }
    }

    //% block="Выключение энкодера %index" blockGap=8
    //% weight=78
    //% group="Энкодеры"
    // color=#e3b838
    export function encoderOff(index: enMotorsAll): void {
        if (index == 1) {
            encoderOff(5);
            encoderOff(2);
            encoderOff(0);
        }
        else if (index == 5) {
            initEncoderM1 = false;
            pins.digitalWritePin(DigitalPin.P13, 1) //отключает подписку на onPulsed
            //control.onEvent(DigitalPin.P13, PulseValue.High, function () { }, 32768) //32768 - это флаг удаления сообщений

        }
        else if (index == 2) {
            initEncoderM2 = false;
            pins.digitalWritePin(DigitalPin.P7, 1) //отключает подписку на onPulsed
        }
        else {
            initEncoderM3 = false;
            pins.digitalWritePin(DigitalPin.P10, 1) //отключает подписку на onPulsed
        }
    }

    //% block="Значение энкодера %index|%mode" blockGap=8
    //% weight=77
    //% group="Энкодеры"
    // color=#e3b838
    export function valueEncoder(index: enMotors, mode: enMode2): number {
        if (index == 5) {
            if (mode == 1) return encoderM1 / 360;
            else return encoderM1;
        }
        else if (index == 2) {
            if (mode == 1) return encoderM2 / 360;
            else return encoderM2;
        }
        else {
            if (mode == 1) return encoderM3 / 360;
            else return encoderM3;
        }
    }
}

//% color="#f08e13" weight=39 icon="\uf055"
namespace YM3_module {

    export enum enPorts4 {
        P3P0 = 1,
        P1P2 = 2,
        P5P11 = 3,
        P4P6 = 4
    }
    export enum enPorts3 {
        P3P0 = 1,
        P1P2 = 2,
        P4P6 = 3
    }
    export enum enPorts2 {
        P3P0 = 1,
        P1P2 = 2
    }
    export enum enRocker {
        //% block="0"
        NoState = 0,
        //% block="Вверх"
        Up,
        //% block="Вниз"
        Down,
        //% block="Влево"
        Left,
        //% block="Вправо"
        Right
    }
    export enum enRocker2 {
        //% block="Влево/вправо"
        LR = 1,
        //% block="Вниз/Вверх"
        DU = 2
    }

    //% block="Ультразвуковой модуль %index"
    //% weight=90
    export function Ultrasonic(index: enPorts4): number {
        //send pulse
        let Trig, Echo;
        if (index == 1) {
            displayOff();
            Trig = DigitalPin.P3; Echo = DigitalPin.P0;
        }
        else if (index == 2) { Trig = DigitalPin.P1; Echo = DigitalPin.P2; }
        else if (index == 3) { Trig = DigitalPin.P5; Echo = DigitalPin.P11; }
        else if (index == 4) {
            displayOff();
            Trig = DigitalPin.P4; Echo = DigitalPin.P6;
        }

        pins.setPull(Trig, PinPullMode.PullNone);
        pins.digitalWritePin(Trig, 0);
        control.waitMicros(2);
        pins.digitalWritePin(Trig, 1);
        control.waitMicros(10);
        pins.digitalWritePin(Trig, 0);

        //считывание импульса, максимальная дальность 500 см
        const d = pins.pulseIn(Echo, PulseValue.High, 500 * 58);

        return Math.idiv(d, 58);
    }

    //% block="Аналоговый ИК модуль %index"
    //% weight=89
    export function IR_ac(index: enPorts2): number {
        let value;
        if (index == 1) {
            value = pins.analogReadPin(AnalogPin.P0);
        } else {
            value = pins.analogReadPin(AnalogPin.P2);
        }
        if (value < 0) value = 0;
        if (value > 1023) value = 1023;
        return Math.round((1023 - value) / 1024 * 100);
    }

    //% block="Цифровой ИК модуль %index"
    //% weight=87
    export function IR_dc(index: enPorts4): boolean {
        let pin;
        let x;
        if (index == 1) { displayOff(); pin = DigitalPin.P3; }
        else if (index == 2) { pin = DigitalPin.P1; }
        else if (index == 3) { pin = DigitalPin.P5; }
        else if (index == 4) { displayOff(); pin = DigitalPin.P4; }
        pins.setPull(pin, PinPullMode.PullUp);
        x = pins.digitalReadPin(pin);
        if (x == 0) { return true; }
        else { return false; }
    }

    //% block="Аналоговый джойстик %value"
    //% weight=80
    export function Rocker_ac(value: enRocker2): number {

        let x = Math.round((pins.analogReadPin(AnalogPin.P1) - 512) / 512 * 100);
        let y = Math.round((pins.analogReadPin(AnalogPin.P2) - 512) / 512 * 100);

        if (value == 1) { return x; }
        else { return y; }
    }

    //% block="Цифровой джойстик %value"
    //% weight=79
    export function Rocker(value: enRocker): boolean {

        let x = pins.analogReadPin(AnalogPin.P1);
        let y = pins.analogReadPin(AnalogPin.P2);

        let now_state = enRocker.NoState;

        if (x < 256) { now_state = enRocker.Left; }
        else if (x > 768) { now_state = enRocker.Right; }
        else {
            if (y < 256) { now_state = enRocker.Down; }
            else if (y > 768) { now_state = enRocker.Up; }
        }
        return now_state == value;
    }

    //% block="Потенциометр %index"
    //% weight=78
    export function Potentiometer(index: enPorts3): number {
        let pin;
        if (index == 1) { displayOff(); pin = AnalogPin.P3; }
        else if (index == 2) { pin = AnalogPin.P1; }
        else if (index == 3) { displayOff(); pin = AnalogPin.P4; }

        return Math.round(pins.analogReadPin(pin) / 1024 * 100);
    }
}

//% color="#3CB371" weight=38 icon="\uf259"
namespace YM3_I2C {

    let COMMAND_I2C_ADDRESS = 0x24
    let DISPLAY_I2C_ADDRESS = 0x34
    let _SEG = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71];

    let TM1650_CDigits = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x82, 0x21, 0x00, 0x00, 0x00, 0x00, 0x02, 0x39, 0x0F, 0x00, 0x00, 0x00, 0x40, 0x80, 0x00,
        0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7f, 0x6f, 0x00, 0x00, 0x00, 0x48, 0x00, 0x53,
        0x00, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71, 0x6F, 0x76, 0x06, 0x1E, 0x00, 0x38, 0x00, 0x54, 0x3F,
        0x73, 0x67, 0x50, 0x6D, 0x78, 0x3E, 0x00, 0x00, 0x00, 0x6E, 0x00, 0x39, 0x00, 0x0F, 0x00, 0x08,
        0x63, 0x5F, 0x7C, 0x58, 0x5E, 0x7B, 0x71, 0x6F, 0x74, 0x02, 0x1E, 0x00, 0x06, 0x00, 0x54, 0x5C,
        0x73, 0x67, 0x50, 0x6D, 0x78, 0x1C, 0x00, 0x00, 0x00, 0x6E, 0x00, 0x39, 0x30, 0x0F, 0x00, 0x00
    ];

    let _intensity = 3
    let dbuf = [0, 0, 0, 0]
    let iPosition = ""

    function cmd(c: number) {
        pins.i2cWriteNumber(COMMAND_I2C_ADDRESS, c, NumberFormat.Int8BE)
    }

    function dat(bit: number, d: number) {
        pins.i2cWriteNumber(DISPLAY_I2C_ADDRESS + (bit % 4), d, NumberFormat.Int8BE)
    }

    //% block="Включить индикатор"
    //% weight=100 blockGap=8
    //% group="Индикатор"
    export function on() {
        cmd(_intensity * 16 + 1)
        clear();
    }

    //% block="Выключить индикатор"
    //% weight=99 blockGap=8
    //% group="Индикатор"
    export function off() {
        clear();
        _intensity = 0
        cmd(0)
    }

    //% block="Очистить индикатор"
    //% weight=98 blockGap=8
    //% group="Индикатор"
    export function clear() {
        dat(0, 0)
        dat(1, 0)
        dat(2, 0)
        dat(3, 0)
        dbuf = [0, 0, 0, 0]
    }

    //% block="Яркость 0-8 %dat"
    //% weight=97 blockGap=8
    //% group="Индикатор"
    //% dat.defl=3
    export function setIntensity(dat: number) {
        if ((dat < 0) || (dat > 8))
            return;
        if (dat == 0)
            off()
        else {
            _intensity = dat
            cmd((dat << 4) | 0x01)
        }
    }

    /*
    //% block="Показать цифру %num|на %bit"
    //% weight=95 blockGap=8
    //% num.max=15 num.min=0
    //% group="Индикатор"
    export function digit(num: number, bit: number) {
        dbuf[bit % 4] = _SEG[num % 16]
        dat(bit, _SEG[num % 16])
    }
    */

    function digit(num: number, bit: number) {
        dbuf[bit % 4] = _SEG[num % 16]
        dat(bit, _SEG[num % 16])
    }

    //% block="Показать число %num"
    //% weight=94 blockGap=8
    //% group="Индикатор"
    export function showNumber(num: number) {
        if (num < 0) {
            dat(0, 0x40) // '-'
            num = -num
        }
        else
            digit(Math.idiv(num, 1000) % 10, 0)

        digit(num % 10, 3)
        digit(Math.idiv(num, 10) % 10, 2)
        digit(Math.idiv(num, 100) % 10, 1)
    }


    //% block="Показать строку %str"
    //% weight=93 blockGap=8
    //% group="Индикатор"
    export function showString(str: string) {
        for (let i = 0; i < 4; i++) {
            let a = str.charCodeAt(i) & 0x7F;
            let dot = str.charCodeAt(i) & 0x80;
            dbuf[i] = TM1650_CDigits[a];
            if (a) {
                pins.i2cWriteNumber(DISPLAY_I2C_ADDRESS + i, dbuf[i] | dot, NumberFormat.Int8BE)
            }
            else {
                break;
            }
        }
    }

    function displayRuning(str: string, del: number): number {
        iPosition = str;
        showString(iPosition);
        basic.pause(del);
        let l = iPosition.length;

        if (l < 4) return 0;
        else return (l - 4);
    }

    function displayRunningShift(): number {
        if (iPosition.length <= 4)
            return 0;
        else {
            iPosition = iPosition.substr(1, iPosition.length - 1);
            showString(iPosition);
            return (iPosition.length - 4);
        }
    }

    //% block="Прокрутка %str |пауза (мс) %del"
    //% weight=90 blockGap=8
    //% group="Индикатор"
    export function showRuning(str: string, del: number) {
        if (displayRuning(str, del)) {
            while (displayRunningShift()) {
                basic.pause(del);
            }
        }
    }

    /*
    //% block="show hex number %num"
    //% weight=89 blockGap=8
    export function showHex(num: number) {
        if (num < 0) {
            dat(0, 0x40) // '-'
            num = -num
        }
        else
            digit((num >> 12) % 16, 0)
        digit(num % 16, 3)
        digit((num >> 4) % 16, 2)
        digit((num >> 8) % 16, 1)
    }
    */

    /*
    //% block="show dot point %bit|show %num"
    //% weight=88 blockGap=8
    export function showDpAt(bit: number, show: boolean) {
        if (show) dat(bit, dbuf[bit % 4] | 0x80)
        else dat(bit, dbuf[bit % 4] & 0x7F)
    }
    */

    let Init_Register_Array = [
        [0xEF, 0x00],
        [0x37, 0x07],
        [0x38, 0x17],
        [0x39, 0x06],
        [0x41, 0x00],
        [0x42, 0x00],
        [0x46, 0x2D],
        [0x47, 0x0F],
        [0x48, 0x3C],
        [0x49, 0x00],
        [0x4A, 0x1E],
        [0x4C, 0x20],
        [0x51, 0x10],
        [0x5E, 0x10],
        [0x60, 0x27],
        [0x80, 0x42],
        [0x81, 0x44],
        [0x82, 0x04],
        [0x8B, 0x01],
        [0x90, 0x06],
        [0x95, 0x0A],
        [0x96, 0x0C],
        [0x97, 0x05],
        [0x9A, 0x14],
        [0x9C, 0x3F],
        [0xA5, 0x19],
        [0xCC, 0x19],
        [0xCD, 0x0B],
        [0xCE, 0x13],
        [0xCF, 0x64],
        [0xD0, 0x21],
        [0xEF, 0x01],
        [0x02, 0x0F],
        [0x03, 0x10],
        [0x04, 0x02],
        [0x25, 0x01],
        [0x27, 0x39],
        [0x28, 0x7F],
        [0x29, 0x08],
        [0x3E, 0xFF],
        [0x5E, 0x3D],
        [0x65, 0x96],
        [0x67, 0x97],
        [0x69, 0xCD],
        [0x6A, 0x01],
        [0x6D, 0x2C],
        [0x6E, 0x01],
        [0x72, 0x01],
        [0x73, 0x35],
        [0x74, 0x00],
        [0x77, 0x01]]

    let Init_PS_Array = [
        [0xEF, 0x00],
        [0x41, 0x00],
        [0x42, 0x00],
        [0x48, 0x3C],
        [0x49, 0x00],
        [0x51, 0x13],
        [0x83, 0x20],
        [0x84, 0x20],
        [0x85, 0x00],
        [0x86, 0x10],
        [0x87, 0x00],
        [0x88, 0x05],
        [0x89, 0x18],
        [0x8A, 0x10],
        [0x9f, 0xf8],
        [0x69, 0x96],
        [0x6A, 0x02],
        [0xEF, 0x01],
        [0x01, 0x1E],
        [0x02, 0x0F],
        [0x03, 0x10],
        [0x04, 0x02],
        [0x41, 0x50],
        [0x43, 0x34],
        [0x65, 0xCE],
        [0x66, 0x0B],
        [0x67, 0xCE],
        [0x68, 0x0B],
        [0x69, 0xE9],
        [0x6A, 0x05],
        [0x6B, 0x50],
        [0x6C, 0xC3],
        [0x6D, 0x50],
        [0x6E, 0xC3],
        [0x74, 0x05]]

    let Init_Gesture_Array = [
        [0xEF, 0x00],
        [0x41, 0x00],
        [0x42, 0x00],
        [0xEF, 0x00],
        [0x48, 0x3C],
        [0x49, 0x00],
        [0x51, 0x10],
        [0x83, 0x20],
        [0x9F, 0xF9],
        [0xEF, 0x01],
        [0x01, 0x1E],
        [0x02, 0x0F],
        [0x03, 0x10],
        [0x04, 0x02],
        [0x41, 0x40],
        [0x43, 0x30],
        [0x65, 0x96],
        [0x66, 0x00],
        [0x67, 0x97],
        [0x68, 0x01],
        [0x69, 0xCD],
        [0x6A, 0x01],
        [0x6B, 0xB0],
        [0x6C, 0x04],
        [0x6D, 0x2C],
        [0x6E, 0x01],
        [0x74, 0x00],
        [0xEF, 0x00],
        [0x41, 0xFF],
        [0x42, 0x01]]

    const PAJ7620_ID = 0x73                   //Адрес модуля распознавания жестов
    const PAJ7620_REGITER_BANK_SEL = 0xEF     //Регистр выделенного банка

    const PAJ7620_BANK0 = 0
    const PAJ7620_BANK1 = 1

    const GES_RIGHT_FLAG = 1
    const GES_LEFT_FLAG = 2
    const GES_UP_FLAG = 4
    const GES_DOWN_FLAG = 8
    const GES_FORWARD_FLAG = 16
    const GES_BACKWARD_FLAG = 32
    const GES_CLOCKWISE_FLAG = 64
    const GES_COUNT_CLOCKWISE_FLAG = 128
    const GES_WAVE_FLAG = 1

    export enum Gesture_state {
        //% block="🠖"
        right = 1,
        //% block="🠔"
        left = 2,
        //% block="🠕"
        up = 4,
        //% block="🠗"
        down = 8,
        //% block="⏶"
        forward = 16,
        //% block="⏷"
        backward = 32,
        //% block="↻"
        clockwise = 64,
        //% block="↺"
        count_clockwise = 128,
        //% block="∿"
        wave = 256
    }

    function GestureWriteReg(addr: number, cmd: number) {
        let buf = pins.createBuffer(2);
        buf[0] = addr;
        buf[1] = cmd;
        pins.i2cWriteBuffer(PAJ7620_ID, buf);
    }

    function GestureReadReg(addr: number): number {
        let buf = pins.createBuffer(1);
        buf[0] = addr;
        pins.i2cWriteBuffer(PAJ7620_ID, buf);

        let result = pins.i2cReadNumber(PAJ7620_ID, NumberFormat.UInt8LE, false);
        return result;
    }

    function GestureSelectBank(bank: number): void {
        switch (bank) {
            case 0:
                GestureWriteReg(PAJ7620_REGITER_BANK_SEL, PAJ7620_BANK0);
                break;
            case 1:
                GestureWriteReg(PAJ7620_REGITER_BANK_SEL, PAJ7620_BANK1);
                break;
            default:
                break;
        }
    }

    let gestureInit = 0;
    let gestureValue = 0;

    //% block="Включение распознавания жестов"
    //% weight=70 blockGap=8
    //% group="Модуль распознавания жестов"
    export function GestureInit(): void {
        for (let i = 0; i <= 2; i++) {
            if (GestureReadReg(0) == 0x20) {
                gestureInit = 1;
                break;
            }
            else
                basic.pause(500); 
        }
        if (!gestureInit)
            return;

        for (let i = 0; i < Init_Register_Array.length; i++)
            GestureWriteReg(Init_Register_Array[i][0], Init_Register_Array[i][1]);

        GestureSelectBank(0);

        for (let i = 0; i < Init_Gesture_Array.length; i++)
            GestureWriteReg(Init_Gesture_Array[i][0], Init_Gesture_Array[i][1]);


        basic.forever(function () {
            if (gestureInit) {
                gestureValue = GestureReadReg(0x43);
                switch (gestureValue) {
                    case GES_RIGHT_FLAG:
                    case GES_LEFT_FLAG:
                    case GES_UP_FLAG:
                    case GES_DOWN_FLAG:
                    case GES_FORWARD_FLAG:
                    case GES_BACKWARD_FLAG:
                    case GES_CLOCKWISE_FLAG:
                    case GES_COUNT_CLOCKWISE_FLAG:
                        break;
                    case 0: {
                        gestureValue = 0;
                        break;
                    }

                    default:
                        gestureValue = GestureReadReg(0x44);
                        if (gestureValue == GES_WAVE_FLAG)
                            gestureValue = 256;
                        break;
                }
            }
            basic.pause(100);
        })
    }

    //% block="Выключение распознавания жестов"
    //% weight=69 blockGap=8
    //% group="Модуль распознавания жестов"
    export function GestureOff(): void {
        gestureInit = 0;
        gestureValue = 0;
    }

    //% block="Жест %state"
    //% weight=68 blockGap=8
    //% group="Модуль распознавания жестов"
    export function GetGesture(state: Gesture_state): boolean {
        if (gestureValue == state) return true;
        else return false;
    }

    const COLOR_ADD = 0X53;
    const COLOR_REG = 0x00;
    const COLOR_R = 0X10;
    const COLOR_G = 0X0D;
    const COLOR_B = 0x13;

    let initialized = false;
    let val_red = 0;
    let val_green = 0;
    let val_blue = 0;

    export enum enGetRGB {
        //% block="R"
        GetValueR = 0,
        //% block="G"
        GetValueG = 1,
        //% block="B"
        GetValueB = 2
    }

    export enum enGetIndex {
        //% block="0-Белый"
        White = 0xFFFFFF,
        //% block="1-Черный"
        Black = 0x000000,
        //% block="2-Красный"
        Red = 0xFF0000,
        //% block="3-Зеленый"
        Green = 0x00FF00,
        //% block="4-Синий"
        Blue = 0x0000FF,
        //% block="5-Желтый"
        Yellow = 0xFFFF00,
        //% block="6-Голубой"
        Light_blue = 0x00FFFF,
        //% block="7-Фиолетовый"
        Purple = 0xFF00FF,
    }

    function i2cWriteData(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(addr, buf);
    }

    function setRegConfig(): void {
        i2cWriteData(COLOR_ADD, COLOR_REG, 0X06);
        i2cWriteData(COLOR_ADD, 0X04, 0X41);
        i2cWriteData(COLOR_ADD, 0x05, 0x01);
    }

    function initColorI2C(): void {
        setRegConfig();
        initialized = true;
    }

    function GetRGB(): void {
        let buff_R = pins.createBuffer(2);
        let buff_G = pins.createBuffer(2);
        let buff_B = pins.createBuffer(2);

        pins.i2cWriteNumber(COLOR_ADD, COLOR_R, NumberFormat.UInt8BE);
        buff_R = pins.i2cReadBuffer(COLOR_ADD, 2);

        pins.i2cWriteNumber(COLOR_ADD, COLOR_G, NumberFormat.UInt8BE);
        buff_G = pins.i2cReadBuffer(COLOR_ADD, 2);

        pins.i2cWriteNumber(COLOR_ADD, COLOR_B, NumberFormat.UInt8BE);
        buff_B = pins.i2cReadBuffer(COLOR_ADD, 2);

        let Red = (buff_R[1] & 0xff) << 8 | (buff_R[0] & 0xff);
        let Green = (buff_G[1] & 0xff) << 8 | (buff_G[0] & 0xff);
        let Blue = (buff_B[1] & 0xff) << 8 | (buff_B[0] & 0xff);

        if (Red > 2300) Red = 2300;
        if (Green > 4600) Green = 4600;
        if (Blue > 2700) Blue = 2700;

        val_red = Math.map(Red, 0, 2300, 0, 255);
        val_green = Math.map(Green, 0, 4600, 0, 255);
        val_blue = Math.map(Blue, 0, 2700, 0, 255);

        val_red = Math.floor(val_red)
        val_green = Math.floor(val_green)
        val_blue = Math.floor(val_blue)

        if (val_red > 255) val_red = 255;
        if (val_green > 255) val_green = 255;
        if (val_blue > 255) val_blue = 255;
    }

    //% block="Значение цвета %value"
    //% blockGap=8
    //% weight=60
    //% group="Модуль распознавания цвета"
    export function GetRGBValue(value: enGetRGB): number {
        if (!initialized) {
            initColorI2C();
        }
        GetRGB();
        switch (value) {
            case enGetRGB.GetValueR:
                return val_red;
            case enGetRGB.GetValueG:
                return val_green;
            case enGetRGB.GetValueB:
                return val_blue;
            default:
                break;
        }
        return 0;
    }

    //% block="Индексированный цвет %value"
    //% blockGap=8
    //% weight=59
    //% group="Модуль распознавания цвета"
    export function GetRGBIndex(value: enGetIndex): boolean {
        if (!initialized) {
            initColorI2C();
        }
        GetRGB();
        switch (value) {
            case enGetIndex.White: {
                if (val_red > 122 && val_green > 122 && val_blue > 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Black: {
                if (val_red <= 122 && val_green <= 122 && val_blue <= 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Red: {
                if (val_red > 122 && val_green <= 122 && val_blue <= 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Green: {
                if (val_red <= 122 && val_green > 122 && val_blue <= 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Blue: {
                if (val_red <= 122 && val_green <= 122 && val_blue > 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Yellow: {
                if (val_red > 122 && val_green > 122 && val_blue <= 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Light_blue: {
                if (val_red <= 122 && val_green > 122 && val_blue > 122)
                    return true;
                else
                    return false;
            }
            case enGetIndex.Purple: {
                if (val_red > 122 && val_green <= 122 && val_blue > 122)
                    return true;
                else
                    return false;
            }
            default:
                return false;
        }
    }

    //% block="Индексированный цвет"
    //% blockGap=8
    //% weight=58
    //% group="Модуль распознавания цвета"
    export function GetRGBIndexNum(): enGetIndex {
        if (!initialized) {
            initColorI2C();
        }
        GetRGB();
        if (val_red > 122 && val_green > 122 && val_blue > 122)
            return enGetIndex.White;
        else if (val_red <= 122 && val_green <= 122 && val_blue <= 122)
            return enGetIndex.Black;
        else if (val_red > 122 && val_green <= 122 && val_blue <= 122)
            return enGetIndex.Red
        else if (val_red <= 122 && val_green > 122 && val_blue <= 122)
            return enGetIndex.Green
        else if (val_red <= 122 && val_green <= 122 && val_blue > 122)
            return enGetIndex.Blue
        else if (val_red > 122 && val_green > 122 && val_blue <= 122)
            return enGetIndex.Yellow
        else if (val_red <= 122 && val_green > 122 && val_blue > 122)
            return enGetIndex.Light_blue
        else if (val_red > 122 && val_green <= 122 && val_blue > 122)
            return enGetIndex.Purple
        else
            return enGetIndex.Black
    }
}


//% color=#2699BF weight=37 icon="\uf110"
namespace YM3_RGB {

    export enum PixelColors {
        //% block=Красный
        Red = 0xFF0000,
        //% block=Оранжевый
        Orange = 0xFFA500,
        //% block=Желтый
        Yellow = 0xFFFF00,
        //% block=Зеленый
        Green = 0x00FF00,
        //% block=Синий
        Blue = 0x0000FF,
        //% block=Индиго
        Indigo = 0x4b0082,
        //% block=Фиолетовый
        Violet = 0x8a2be2,
        //% block=Лиловый
        Purple = 0xFF00FF,
        //% block=Белый
        White = 0xFFFFFF,
        //% block=Черный
        Black = 0x000000
    }

    //% shim=sendBufferAsm
    function sendBuffer(buf: Buffer, pin: DigitalPin) {
    }

    export class RGB4 {
        buf: Buffer;
        pin: DigitalPin;
        // TODO: encode as bytes instead of 32bit
        brightness: number;
        start: number; // start offset in LED strip
        _length: number; // number of LEDs
        _mode: number;
        _matrixWidth: number; // number of leds in a matrix - if any
        _matrixChain: number; // the connection type of matrix chain
        _matrixRotation: number; // the rotation type of matrix

        showColor(rgb: number) {
            rgb = rgb >> 0;
            this.setAllRGB(rgb);
            this.show();
        }

        setPixelColor(pixeloffset: number, rgb: number): void {
            this.setPixelRGB(pixeloffset >> 0, rgb >> 0);
            this.show();
        }

        show() {
            sendBuffer(this.buf, this.pin);
        }

        clear(): void {
            this.buf.fill(0, this.start * 3, this._length * 3);
            this.show();
        }

        setBrightness(brightness: number): void {
            this.brightness = brightness & 0xff;
        }

        rotate(offset: number = 1): void {
            offset = offset >> 0;
            this.buf.rotate(-offset * 3, this.start * 3, this._length * 3)
            this.show();
        }

        setPin(pin: DigitalPin): void {
            this.pin = pin;
            pins.digitalWritePin(this.pin, 0);
            // don't yield to avoid races on initialization
        }

        private setBufferRGB(offset: number, red: number, green: number, blue: number): void {
            this.buf[offset + 1] = red;
            this.buf[offset + 0] = green;
            this.buf[offset + 2] = blue;
        }

        private setAllRGB(rgb: number) {
            let red = unpackR(rgb);
            let green = unpackG(rgb);
            let blue = unpackB(rgb);

            const br = this.brightness;
            if (br < 255) {
                red = (red * br) >> 8;
                green = (green * br) >> 8;
                blue = (blue * br) >> 8;
            }
            const end = this.start + this._length;
            for (let i = this.start; i < end; ++i) {
                this.setBufferRGB(i * 3, red, green, blue)
            }
        }
        private setPixelRGB(pixeloffset: number, rgb: number): void {
            if (pixeloffset < 0
                || pixeloffset >= this._length)
                return;

            pixeloffset = (pixeloffset + this.start) * 3;

            let red = unpackR(rgb);
            let green = unpackG(rgb);
            let blue = unpackB(rgb);

            let br = this.brightness;
            if (br < 255) {
                red = (red * br) >> 8;
                green = (green * br) >> 8;
                blue = (blue * br) >> 8;
            }
            this.setBufferRGB(pixeloffset, red, green, blue)
        }
    }

    //% block="Инициализация светодиодов"
    //% weight=101 blockGap=8
    export function create(): void {
        strip = new RGB4();
        strip.buf = pins.createBuffer(12);
        strip.start = 0;
        strip._length = 4;
        strip._mode = 2;
        strip._matrixWidth = 0;
        strip.setBrightness(255);
        strip.setPin(DigitalPin.P12);
    }

    let strip: RGB4;

    //% block="Все светодиоды %rgb=pixel_colors"
    //% blockGap=8
    //% weight=95
    export function showColor(rgb: number) {
        strip.showColor(rgb);
    }

    //% block="Светодиод № %pixeloffset|%rgb=pixel_colors"
    //% blockGap=8
    //% weight=80
    export function setPixelColor(pixeloffset: number, rgb: number): void {
        strip.setPixelColor(pixeloffset, rgb);
    }

    //% block="Выключить все"
    //% blockGap=8
    //% weight=76
    export function clear(): void {
        strip.clear();
    }

    //% block="Яркость %brightness 0-100"
    //% blockGap=8
    //% weight=59
    export function setBrightness(brightness: number): void {
        strip.setBrightness(brightness*2.55);
    }

    //% block="Вращение на %offset"
    //% blockGap=8
    //% weight=39
    export function rotate(offset: number = 1): void {
        strip.rotate(offset);
    }

    //% weight=1
    //% block="R %red|G %green|B %blue"
    export function rgb(red: number, green: number, blue: number): number {
        return packRGB(red, green, blue);
    }

    //% weight=2 blockGap=8
    //% blockId="pixel_colors" block="%color"
    //% blockHidden=true
    export function colors(color: PixelColors): number {
        return color;
    }

    function packRGB(a: number, b: number, c: number): number {
        return ((a & 0xFF) << 16) | ((b & 0xFF) << 8) | (c & 0xFF);
    }
    function unpackR(rgb: number): number {
        let r = (rgb >> 16) & 0xFF;
        return r;
    }
    function unpackG(rgb: number): number {
        let g = (rgb >> 8) & 0xFF;
        return g;
    }
    function unpackB(rgb: number): number {
        let b = (rgb) & 0xFF;
        return b;
    }
}
/*
Copyright (C): 2024, SkillCraft
*/

//% color="#cd4896" weight=40 icon="\uf085" //#9a1564
namespace YM3_motor {

    const PCA9685_ADD = 0x40
    const MODE1 = 0x00
    const LED0_ON_L = 0x06
    const PRESCALE = 0xFE

    let initialized = false

    let initEncoderM1 = false
    let initEncoderM2 = false
    let initEncoderM3 = false

    let encoderM1 = 0
    let encoderM2 = 0
    let encoderM3 = 0

    let encoderM1Time = 0
    let encoderM2Time = 0

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
        M1 = 8,
        M2 = 10,
        M3 = 12
    }
    export enum enMotors2 {
        M1 = 8,
        M2 = 10
    }
    export enum enMotorsAll {
        M1 = 8,
        M2 = 10,
        M3 = 12,
        //% block="Все"
        M1M2M3 = 1
    }
    export enum enMotors2All {
        M1 = 8,
        M2 = 10,
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

    function initEncoder(index: enMotors2All): void { //тут нужно будет заменить на enMotors
        if (index == 1) {
            initEncoder(8);
            initEncoder(10);
        }
        else if (index == 8) {
            if (!initEncoderM1) {
                initEncoderM1 = true;
                pins.onPulsed(DigitalPin.P13, PulseValue.High, function () {
                    if (control.micros() - encoderM1Time > 2500) {
                        encoderM1Time = control.micros();
                        if (pins.digitalReadPin(DigitalPin.P14) == 1) {
                            encoderM1 += 2;
                        } else {
                            encoderM1 -= 2;
                        }
                    }
                });
            }
        }
        else if (index == 10) {
            if (!initEncoderM2) {
                initEncoderM2 = true;
                pins.setPull(DigitalPin.P12, PinPullMode.PullNone)
                pins.onPulsed(DigitalPin.P8, PulseValue.High, function () { //тут будет пара 7 и 8 порта с выключением LED матрицы из-за порта 7
                    if (control.micros() - encoderM2Time > 2500) {
                        encoderM2Time = control.micros();
                        if (pins.digitalReadPin(DigitalPin.P12) == 1) {
                            encoderM2 += 2;
                        } else {
                            encoderM2 -= 2;
                        }
                    }
                });
            }
        }//тут нужно будет добавить инициализацию третьего энкодера на портах 9 и 10 с выключением LED матрицы из-за порта 10
    }

    //% block="Сервомотор|%num|%angle\\°" blockGap=8
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
        //if (x < 200) x = 200;
        basic.pause(x); //пауза пропорциональна разнице прошлого угла и текущего
        if (index == 3) servo4 = angle;
        else servo8 = angle;
    }

    //% block="Мотор по мощности|%index|%speed\\%" blockGap=8
    //% weight=99
    //% group="Мотор"
    //% speed.min=-100 speed.max=100 speed.defl=75 speed.shadow="speedPicker"
    //% inlineInputMode=inline
    export function MotorRun(index: enMotorsAll, speed: number): void {
        if (!initialized) {
            initPCA9685()
        }

        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        if (speed > 0) speed = Math.map(speed, 1, 100, 800, 4095); //устраняется мертвая зона мотора около 0
        else if (speed < 0) speed = Math.map(speed, -1, -100, -800, -4095);

        if (speed > 4095) speed = 4095;
        if (speed < -4095) speed = -4095;

        if (index == 1) {
            MotorRun(8, speed);
            MotorRun(10, speed);
            MotorRun(12, speed);
        } else {

            if (index == 8)
                speed *= invertM1;
            else if (index == 10)
                speed *= invertM2;
            else
                speed *= invertM3;

            let a = index
            let b = index + 1

            if (a > 10) {
                if (speed >= 0) {
                    setPwm(a, 0, speed)
                    setPwm(b, 0, 0)
                } else {
                    setPwm(a, 0, 0)
                    setPwm(b, 0, -speed)
                }
            }
            else {
                if (speed >= 0) {
                    setPwm(b, 0, speed)
                    setPwm(a, 0, 0)
                } else {
                    setPwm(b, 0, 0)
                    setPwm(a, 0, -speed)
                }
            }
        }
    }

    //% block="Мотор по времени|%index|%speed\\%|%time\\c|%lock" blockGap=8
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

    //% block="Мотор по энкодеру|%index|%speed\\%|%rotations\\↻|%degrees\\°|%mode|%lock" blockGap=8
    //% weight=97
    //% group="Мотор"
    //% speed.min=-100 speed.max=100 speed.defl=75 speed.shadow="speedPicker"
    //% rotations.defl=1 degrees.defl=360
    //% inlineInputMode=inline
    export function MotorRunRD(index: enMotors2, speed: number, rotations: number, degrees: number, mode: enMode, lock: enLock): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        let enc = 0;

        encoderM1 = 0; // если нужно непрерывно считать энкодеры, то это закомментировать
        encoderM2 = 0;

        let motor;
        if (index == 8) motor = 8;
        else if (index == 10) motor = 10;

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

        if (index == 8) {
            if (speed < 0) {
                enc *= -1;
                enc += encoderM1;
                while (enc < (encoderM1 + speed / 4)) { basic.pause(1); }
            }
            else {
                enc += encoderM1;
                while (enc > (encoderM1 + speed / 4)) { basic.pause(1); }
            }
        }
        else if (index == 10) {
            if (speed < 0) {
                enc *= -1;
                enc += encoderM2;
                while (enc < (encoderM2 + speed / 4)) { basic.pause(1); }
            }
            else {
                enc += encoderM2;
                while (enc > (encoderM2 + speed / 4)) { basic.pause(1); }
            }
        }

        encoderOff(motor); // если нужно непрерывно считать энкодеры, то это закомментировать

        if (lock == 1) MotorLock(motor, 1);
        else MotorRun(motor, 0);
    }

    //% block="Инвертирование мотора|%index" blockGap=8
    //% weight=96
    //% group="Мотор"
    export function MotorInvert(index: enMotorsAll): void {
        if (index == 1) {
            invertM1 *= -1;
            invertM2 *= -1;
            invertM3 *= -1;
        }
        else if (index == 8)
            invertM1 *= -1;
        else if (index == 10)
            invertM2 *= -1;
        else
            invertM3 *= -1;
    }

    //% block="Рулевое управление по мощности|%motor|%steer\\↑|%speed\\%" blockGap=8
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
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
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

    //% block="Рулевое управление по времени|%motor|%steer\\↑|%speed\\%|%time\\c|%lock" blockGap=8
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
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
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

    //% block="Рулевое управление по энкодеру М1М2|%steer\\↑|%speed\\%|%rotations\\↻|%degrees\\°|%mode|%lock" blockGap=8
    //% weight=90
    //% steer.shadow=speedPicker steer.min=-100 steer.max=100 steer.defl=0
    //% speed.shadow=speedPicker speed.min=-100 speed.max=100 speed.defl=75
    //% rotations.defl=1 degrees.defl=360
    //% inlineInputMode=inline
    //% group="Рулевое управление моторами"
    export function MotorRunSteerRD(steer: number, speed: number, rotations: number, degrees: number, mode: enMode, lock: enLock): void {
        if (speed > 100) speed = 100;
        if (speed < -100) speed = -100;

        if (steer > 100) steer = 100;
        if (steer < -100) steer = -100;

        let motor1 = 8;
        let motor2 = 10;

        let enc = 0;

        encoderM1 = 0; // если нужно непрерывно считать энкодеры, то это закомментировать
        encoderM2 = 0;

        /* до появления энкодеров у третьего мотора неактуально
        if (motor == 1) {
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
        }
        */

        if (mode == 1) {
            enc += Math.abs(rotations) * 360;
        }
        else if (mode == 2) {
            enc += Math.abs(degrees);
        }
        else if (mode == 3) {
            enc += Math.abs(rotations) * 360 + Math.abs(degrees);
        }

        if (steer >= 0) {
            initEncoder(motor1);
            MotorRun(motor1, speed);
            if (speed >= 0)
                MotorRun(motor2, speed - steer * 2);
            else
                MotorRun(motor2, speed + steer * 2);

            if (speed < 0) {
                enc *= -1;
                enc += encoderM1;
                while (enc < (encoderM1 + speed / 4)) { basic.pause(1); }
            }
            else {
                enc += encoderM1;
                while (enc > (encoderM1 + speed / 4)) { basic.pause(1); }
            }
            encoderOff(motor1); // если нужно непрерывно считать энкодеры, то это закомментировать
        } else {
            initEncoder(motor2);
            MotorRun(motor2, speed);
            if (speed >= 0)
                MotorRun(motor1, speed + steer * 2);
            else
                MotorRun(motor1, speed - steer * 2);

            if (speed < 0) {
                enc *= -1;
                enc += encoderM2;
                while (enc < (encoderM2 + speed / 4)) { basic.pause(1); }
            }
            else {
                enc += encoderM2;
                while (enc > (encoderM2 + speed / 4)) { basic.pause(1); }
            }
            encoderOff(motor2); // если нужно непрерывно считать энкодеры, то это закомментировать
        }

        if (lock == 1) MotorLock(1, 1); //1 - это М1М2
        else MotorRun(1, 0);
    }

    //% block="Танковое управление по мощности|%motor|%speed1\\%|%speed2\\%" blockGap=8
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
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
        }

        MotorRun(motor1, speed1);
        MotorRun(motor2, speed2);
    }

    //% block="Танковое управление по времени|%motor|%speed1\\%|%speed2\\%|%time\\c|%lock" blockGap=8
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
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
        }

        MotorRun(motor1, speed1);
        MotorRun(motor2, speed2);

        basic.pause(Math.abs(time) * 1000);

        if (lock == 1) MotorLockDual(motor, 1);
        else MotorLockDual(motor, 0);
    }

    //% block="Танковое управление по энкодеру М1М2|%speed1\\%|%speed2\\%|%rotations\\↻|%degrees\\°|%mode|%lock" blockGap=8
    //% weight=87
    //% speed1.shadow=speedPicker speed1.min=-100 speed1.max=100 speed1.defl=75
    //% speed2.shadow=speedPicker speed2.min=-100 speed2.max=100 speed2.defl=75
    //% rotations.defl=1 degrees.defl=360
    //% inlineInputMode=inline
    //% group="Танковое управление моторами"
    export function MotorRunTankRD(speed1: number, speed2: number, rotations: number, degrees: number, mode: enMode, lock: enLock): void {
        if (speed1 > 100) speed1 = 100;
        if (speed1 < -100) speed1 = -100;

        if (speed2 > 100) speed2 = 100;
        if (speed2 < -100) speed2 = -100;

        let motor1 = 8;
        let motor2 = 10;

        let enc = 0;

        encoderM1 = 0; // если нужно непрерывно считать энкодеры, то это закомментировать
        encoderM2 = 0;

        /* до появления энкодеров у третьего мотора неактуально
        if (motor == 1) {
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
        }
        */

        if (mode == 1) {
            enc += Math.abs(rotations) * 360;
        }
        else if (mode == 2) {
            enc += Math.abs(degrees);
        }
        else if (mode == 3) {
            enc += Math.abs(rotations) * 360 + Math.abs(degrees);
        }

        if (Math.abs(speed1) >= Math.abs(speed2)) {
            initEncoder(motor1);
            MotorRun(motor1, speed1);
            MotorRun(motor2, speed2);

            if (speed1 < 0) {
                enc *= -1;
                enc += encoderM1;
                while (enc < (encoderM1 + speed1 / 4)) { basic.pause(1); }
            }
            else {
                enc += encoderM1;
                while (enc > (encoderM1 + speed1 / 4)) { basic.pause(1); }
            }
            encoderOff(motor1); // если нужно непрерывно считать энкодеры, то это закомментировать
        } else {
            initEncoder(motor2);
            MotorRun(motor1, speed1);
            MotorRun(motor2, speed2);

            if (speed2 < 0) {
                enc *= -1;
                enc += encoderM2;
                while (enc < (encoderM2 + speed2 / 4)) { basic.pause(1); }
            }
            else {
                enc += encoderM2;
                while (enc > (encoderM2 + speed2 / 4)) { basic.pause(1); }
            }
            encoderOff(motor2); // если нужно непрерывно считать энкодеры, то это закомментировать
        }

        if (lock == 1) MotorLock(1, 1); //1 - это М1М2
        else MotorRun(1, 0);
    }

    //% block="Остановка мотора|%index|%lock" blockGap=8
    //% weight=85
    //% group="Остановка моторов"
    export function MotorLock(index: enMotorsAll, l: enLock): void {
        if (!initialized) {
            initPCA9685()
        }
        if (l == 1) {
            if (index != 1) {
                setPwm(index, 0, 4095)
                setPwm(index + 1, 0, 4095)

            } else {
                setPwm(8, 0, 4095)
                setPwm(8 + 1, 0, 4095)
                setPwm(10, 0, 4095)
                setPwm(10 + 1, 0, 4095)
                setPwm(12, 0, 4095)
                setPwm(12 + 1, 0, 4095)
            }
            basic.pause(200)
        }

        if (index != 1) {
            MotorRun(index, 0);
        } else {
            MotorRun(8, 0);
            MotorRun(10, 0);
            MotorRun(12, 0);
        }
    }

    //% block="Остановка двух моторов|%motor|%lock" blockGap=8
    //% weight=84
    //% group="Остановка моторов"
    //% inlineInputMode=inline
    export function MotorLockDual(motor: enMotorsDual, l: enLock): void {
        if (!initialized) {
            initPCA9685()
        }
        let motor1;
        let motor2;
        if (motor == 1) {
            motor1 = 8;
            motor2 = 10;
        } else if (motor == 2) {
            motor1 = 8;
            motor2 = 12;
        } else {
            motor1 = 10;
            motor2 = 12;
        }
        if (l == 1) {
            setPwm(motor1, 0, 4095)
            setPwm(motor1 + 1, 0, 4095)
            setPwm(motor2, 0, 4095)
            setPwm(motor2 + 1, 0, 4095)
            basic.pause(200)
        }

        MotorRun(motor1, 0);
        MotorRun(motor2, 0);
    }

    //% block="Включение/обнуление энкодера|%index" blockGap=8
    //% weight=80
    //% group="Энкодеры"
    // color=#e3b838
    export function zeroEncoder(index: enMotors2All): void {
        if (index != 1) {
            initEncoder(index);
            if (index == 8) encoderM1 = 0;
            else if (index == 10) encoderM2 = 0;
        } else {
            initEncoder(8);
            initEncoder(10);
            encoderM1 = 0;
            encoderM2 = 0;
        }
    }

    //% block="Выключение энкодера|%index" blockGap=8
    //% weight=78
    //% group="Энкодеры"
    // color=#e3b838
    export function encoderOff(index: enMotors2All): void {
        if (index == 1) {
            encoderOff(8);
            encoderOff(10);
        }
        else if (index == 8) {
            initEncoderM1 = false;
            pins.digitalWritePin(DigitalPin.P13, 1) //отключает подписку на onPulsed
            //control.onEvent(DigitalPin.P13, PulseValue.High, function () { }, 32768) //32768 - это флаг удаления сообщений

        }
        else if (index == 10) {
            initEncoderM2 = false;
            pins.digitalWritePin(DigitalPin.P8, 1) //отключает подписку на onPulsed
        }
    }

    //% block="Значение энкодера|%index|%mode" blockGap=8
    //% weight=77
    //% group="Энкодеры"
    // color=#e3b838
    export function valueEncoder(index: enMotors2, mode: enMode2): number {
        if (index == 8) {
            if (mode == 1) return encoderM1 / 360;
            else return encoderM1;
        }
        else if (index == 10) {
            if (mode == 1) return encoderM2 / 360;
            else return encoderM2;
        }
        else {
            return 0;
        }
    }
}

//% color="#f08e13" weight=39 icon="\uf055"
namespace YM3_module {

    export enum enPorts4 {
        P0P3 = 1,
        P1P2 = 2,
        P5P11 = 3,
        P4P6 = 4
    }
    export enum enPorts3 {
        P0P3 = 1,
        P1P2 = 2,
        P4P6 = 3
    }
    export enum enPorts2 {
        P0P3 = 1,
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

    let display = 0;

    function displayOff(): void {
        if (!display) {
            led.enable(false);
            display = 1;
        }
    }

    //% block="Ультразвуковой модуль|%index"
    //% weight=90
    export function Ultrasonic(index: enPorts4): number {
        //send pulse
        let Trig, Echo;
        if (index == 1) {
            displayOff();
            Trig = DigitalPin.P0; Echo = DigitalPin.P3;
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

    //% block="Аналоговый ИК модуль|%index"
    //% weight=89
    export function IR_ac(index: enPorts2): number {
        let value;
        if (index == 1) {
            displayOff();
            value = pins.analogReadPin(AnalogPin.P3);
        } else {
            value = pins.analogReadPin(AnalogPin.P2);
        }
        if (value < 0) value = 0;
        if (value > 1023) value = 1023;
        return Math.round((1023 - value) / 1024 * 100);
    }

    //% block="Разница ИК"
    //% weight=88
    export function IR_acDif(): number {
        let value;
        let value1;
        let value2;

        displayOff();

        value1 = Math.map(pins.analogReadPin(AnalogPin.P3), 600, 1023, 0, 1023);
        if (value1 < 0) value1 = 0;
        if (value1 > 1023) value1 = 1023;

        value2 = pins.analogReadPin(AnalogPin.P2);

        value = value1 - value2;

        return Math.round((1023 - value) / 1024 * 100) - 70;
    }

    //% block="Цифровой ИК модуль|%index"
    //% weight=87
    export function IR_dc(index: enPorts4): boolean {
        let pin;
        let x;
        if (index == 1) { pin = DigitalPin.P0; }
        else if (index == 2) { pin = DigitalPin.P1; }
        else if (index == 3) { pin = DigitalPin.P5; }
        else if (index == 4) { displayOff(); pin = DigitalPin.P4; }
        pins.setPull(pin, PinPullMode.PullUp);
        x = pins.digitalReadPin(pin);
        if (x == 0) { return true; }
        else { return false; }
    }

    //% block="Аналоговый джойстик|%index|%value"
    //% weight=80
    export function Rocker_ac(value: enRocker2): number {

        let x = Math.round((pins.analogReadPin(AnalogPin.P1) - 512) / 1024 * 100);
        let y = Math.round((pins.analogReadPin(AnalogPin.P2) - 512) / 1024 * 100);

        if (value == 1) { return x; }
        else { return y; }
    }

    //% block="Цифровой джойстик|%index|%value"
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

    //% block="Потенциометр|%index"
    //% weight=78
    export function Potentiometer(index: enPorts3): number {
        let pin;
        if (index == 1) { pin = AnalogPin.P0; }
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
    export function showSring(str: string) {
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
        showSring(iPosition);
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
            showSring(iPosition);
            return (iPosition.length - 4);
        }
    }

    //% block="Прокрутка %str | пауза (мс) %del"
    //% weight=90 blockGap=8
    //% group="Индикатор"
    export function showRunging(str: string, del: number) {
        if (displayRuning(str, del)) {
            while (displayRunningShift()) {
                basic.pause(del);
            }
        }
    }

    /**
     * show a number in hex format
     * @param num is number will be shown, eg: 123
     */
    /*
    //% blockId="TM650_SHOW_HEX_NUMBER" block="show hex number %num"
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

    /**
     * show Dot Point in given position
     * @param bit is positiion, eg: 0
     * @param show is true/false, eg: true
     */
    /*
    //% blockId="TM650_SHOW_DP" block="show dot point %bit|show %num"
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
        while (!gestureInit) {
            if (GestureReadReg(0) == 0x20)
                gestureInit = 1;
            else
                basic.pause(500);
        }

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
        //% block="8-?"
        None = 0x000001
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
    //%group="Модуль распознавания цвета"
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
            return enGetIndex.None
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

    export enum PixelMode {
        //% block="GRB"
        RGB = 0,
        //% block="RGB+W"
        RGBW = 1,
        //% block="RGB"
        RGB_RGB = 2
    }

    //% shim=sendBufferAsm
    function sendBuffer(buf: Buffer, pin: DigitalPin) {
    }

    /*
    let yahRGB: YM3_RGB.RGB4;

    //% block="RGB4"
    //% weight=100
    export function RGB_Program(): YM3_RGB.RGB4 {
        if (!yahRGB) {
            yahRGB = YM3_RGB.create(DigitalPin.P12, 4, PixelMode.RGB);
        }
        return yahRGB;
    }
    */

    export class RGB4 {
        buf: Buffer;
        pin: DigitalPin;
        // TODO: encode as bytes instead of 32bit
        brightness: number;
        start: number; // start offset in LED strip
        _length: number; // number of LEDs
        _mode: PixelMode;
        _matrixWidth: number; // number of leds in a matrix - if any
        _matrixChain: number; // the connection type of matrix chain
        _matrixRotation: number; // the rotation type of matrix

        //% block="%RGB4 Все светодиоды|%rgb=neopixel_colors"
        //% weight=95 blockGap=8
        showColor(rgb: number) {
            rgb = rgb >> 0;
            this.setAllRGB(rgb);
            this.show();
        }

        //% blockId="neopixel_set_pixel_color" block="%RGB4|светодиод № %pixeloffset|%rgb=neopixel_colors"
        //% blockGap=8
        //% weight=80
        setPixelColor(pixeloffset: number, rgb: number): void {
            this.setPixelRGB(pixeloffset >> 0, rgb >> 0);
            this.show();
        }

        //% blockId="neopixel_show" block="%RGB4|отобразить" blockGap=8
        //% weight=79
        //% blockHidden=true
        show() {
            sendBuffer(this.buf, this.pin);
        }

        //% blockId="neopixel_clear" block="%RGB4|выключить все"
        //% weight=76
        clear(): void {
            const stride = this._mode === PixelMode.RGBW ? 4 : 3;
            this.buf.fill(0, this.start * stride, this._length * stride);
            this.show();
        }

        //% blockId="neopixel_set_brightness" block="%RGB4|яркость %brightness 0-255" blockGap=8
        //% weight=59
        setBrightness(brightness: number): void {
            this.brightness = brightness & 0xff;
        }

        //% blockId="neopixel_rotate" block="%RGB4|вращение с %offset" blockGap=8
        //% weight=39
        rotate(offset: number = 1): void {
            offset = offset >> 0;
            const stride = this._mode === PixelMode.RGBW ? 4 : 3;
            this.buf.rotate(-offset * stride, this.start * stride, this._length * stride)
            this.show();
        }

        //% weight=10
        setPin(pin: DigitalPin): void {
            this.pin = pin;
            pins.digitalWritePin(this.pin, 0);
            // don't yield to avoid races on initialization
        }

        private setBufferRGB(offset: number, red: number, green: number, blue: number): void {
            if (this._mode === PixelMode.RGB_RGB) {
                this.buf[offset + 0] = red;
                this.buf[offset + 1] = green;
            } else {
                this.buf[offset + 0] = green;
                this.buf[offset + 1] = red;
            }
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
            const stride = this._mode === PixelMode.RGBW ? 4 : 3;
            for (let i = this.start; i < end; ++i) {
                this.setBufferRGB(i * stride, red, green, blue)
            }
        }
        private setAllW(white: number) {
            if (this._mode !== PixelMode.RGBW)
                return;

            let br = this.brightness;
            if (br < 255) {
                white = (white * br) >> 8;
            }
            let buf = this.buf;
            let end = this.start + this._length;
            for (let i = this.start; i < end; ++i) {
                let ledoffset = i * 4;
                buf[ledoffset + 3] = white;
            }
        }
        private setPixelRGB(pixeloffset: number, rgb: number): void {
            if (pixeloffset < 0
                || pixeloffset >= this._length)
                return;

            let stride = this._mode === PixelMode.RGBW ? 4 : 3;
            pixeloffset = (pixeloffset + this.start) * stride;

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
        private setPixelW(pixeloffset: number, white: number): void {
            if (this._mode !== PixelMode.RGBW)
                return;

            if (pixeloffset < 0
                || pixeloffset >= this._length)
                return;

            pixeloffset = (pixeloffset + this.start) * 4;

            let br = this.brightness;
            if (br < 255) {
                white = (white * br) >> 8;
            }
            let buf = this.buf;
            buf[pixeloffset + 3] = white;
        }
    }

    //% blockId="neopixel_create" block="RGB4 на %pin|с %numleds|светодиодами в %mode"
    //% weight=101 blockGap=8
    //% trackArgs=0,2
    //% blockSetVariable=RGB4
    //% pin.defl=DigitalPin.P12
    //% numleds.defl=4
    export function create(pin: DigitalPin, numleds: number, mode: PixelMode): RGB4 {
        let strip = new RGB4();
        let stride = mode === PixelMode.RGBW ? 4 : 3;
        strip.buf = pins.createBuffer(numleds * stride);
        strip.start = 0;
        strip._length = numleds;
        strip._mode = mode;
        strip._matrixWidth = 0;
        strip.setBrightness(255)
        strip.setPin(pin)
        return strip;
    }

    //% weight=1
    //% blockId="neopixel_rgb" block="R %red|G %green|B %blue"
    export function rgb(red: number, green: number, blue: number): number {
        return packRGB(red, green, blue);
    }

    //% weight=2 blockGap=8
    //% blockId="neopixel_colors" block="%color"
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
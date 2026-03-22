import winston from 'winston';
import Transport from 'winston-transport';

export interface Log {
    timestamp: string;
    level: string;
    message: string;
    correlationId?: string;
    [key: string]: any;
}

class MemoryTransport extends Transport {
    logs: Log[] = [];
    maxLogs = 200;

    log(info: any, callback: () => void) {
        setImmediate(() => { this.emit('logged', info); });

        // Map winston format to original UI API expectation
        this.logs.push({
            timestamp: info.timestamp || new Date().toISOString(),
            level: info.level.toUpperCase(),
            message: info.message || "",
            correlationId: info.correlationId,
            ...info
        });

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        callback();
    }

    getLogs() {
        return this.logs;
    }
}

const memoryTransport = new MemoryTransport();

const winstonLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
                    let formattedMsg = `${timestamp} [${level}]`;
                    if (correlationId) {
                        formattedMsg += ` [corrId:${correlationId}]`;
                    }
                    formattedMsg += ` ${message}`;
                    const metaStr = Object.keys(meta).filter(k => k !== 'service').length ? JSON.stringify(meta) : '';
                    return formattedMsg + (metaStr ? ` ${metaStr}` : '');
                })
            )
        }),
        memoryTransport
    ]
});

// Polyfill mapping so the rest of the application utilizing `logger.log()` continues unconditionally without needing immediate refactors
const enhancedLogger = {
    log: (...args: any[]) => winstonLogger.info(args.join(' ')),
    info: (msg: string, meta?: any) => winstonLogger.info(msg, meta),
    warn: (msg: string, meta?: any) => winstonLogger.warn(msg, meta),
    error: (msg: string | Error, meta?: any) => {
        if (msg instanceof Error) {
            winstonLogger.error(msg.message, { ...meta, stack: msg.stack });
        } else {
            winstonLogger.error(msg, meta);
        }
    },
    debug: (msg: string, meta?: any) => winstonLogger.debug(msg, meta),
    getLogs: () => memoryTransport.getLogs()
};

export default enhancedLogger;

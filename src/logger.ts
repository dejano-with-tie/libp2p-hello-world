import winston from "winston";
import {Format} from "logform";

const formats: Format[] = [
    winston.format.simple(),
    winston.format.colorize(),
    winston.format.splat(),
    winston.format.ms(),
]

const logger = winston.createLogger({
    level: 'debug',

    format: winston.format.combine(...formats),
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({filename: 'error.log', level: 'error'}),
        new winston.transports.File({filename: 'combined.log'}),
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.combine(...formats)),
    }));
}
export default logger;
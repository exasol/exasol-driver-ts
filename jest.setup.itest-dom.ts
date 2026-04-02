import { TextDecoder, TextEncoder } from 'util';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { MessageChannel, MessagePort } from 'node:worker_threads';

global.TextDecoder = TextDecoder as typeof global.TextDecoder;
global.TextEncoder = TextEncoder as typeof global.TextEncoder;

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream as typeof global.ReadableStream;
}

if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = WritableStream as typeof global.WritableStream;
}

if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = TransformStream as typeof global.TransformStream;
}

if (typeof global.MessagePort === 'undefined') {
  global.MessagePort = MessagePort as typeof global.MessagePort;
}

if (typeof global.MessageChannel === 'undefined') {
  global.MessageChannel = MessageChannel as typeof global.MessageChannel;
}

// https://stackoverflow.com/questions/44303784/javascript-aes-encryption-is-slow

// Test decryption with single update(), many update()s, and node
// Test chunk size for many update()s

const forge = require('..');
const assert = require('assert');
const crypto = require('crypto');

const pwd = "aStringPassword";
const iv = forge.random.getBytesSync(16);
const salt = forge.random.getBytesSync(16);
const key = forge.pkcs5.pbkdf2(pwd, salt, 100, 16);

function test_forge(bytes) {
  const buf = forge.util.createBuffer(bytes);
  const start = new Date();

  const decipher = forge.cipher.createDecipher('AES-CBC', key);
  decipher.start({iv: iv});
  decipher.update(buf);
  const result = decipher.finish();
  assert(result);
  const plain = decipher.output.getBytes();

  const time = (new Date() - start) / 1000;
  //console.log(`decrypted in ${time}s`);

  return {
    time,
    plain
  };
}

function test_forge_chunk(bytes, blockSize) {
  if(!blockSize) {
    blockSize = 1024 * 16;
  }
  const start = new Date();

  const decipher = forge.cipher.createDecipher('AES-CBC', key);
  decipher.start({iv: iv});
  const length = bytes.length;
  let index = 0;
  let plain = '';
  do {
    plain += decipher.output.getBytes();
    const buf = forge.util.createBuffer(bytes.substr(index, blockSize));
    decipher.update(buf);
    index += blockSize;
  } while(index < length);
  const result = decipher.finish();
  assert(result);
  plain += decipher.output.getBytes();

  const time = (new Date() - start) / 1000;
  //console.log(`decrypted in ${time}s`);

  return {
    time,
    plain
  };
}

function test_node(bytes) {
  const bufb = new Buffer(bytes, 'binary');
  const ivb = new Buffer(iv, 'binary');
  const keyb = new Buffer(key, 'binary');

  const start = new Date();

  const decipher = crypto.createDecipheriv('aes-128-cbc', keyb, ivb);

  let plain = decipher.update(bufb, 'utf8', 'utf8');
  plain += decipher.final('utf8');

  const time = (new Date() - start) / 1000;
  //console.log(`decrypted in ${time}s`);

  return {
    time,
    plain
  };
}

function data(megs) {
  // FIXME: slow to build/enc data
  const start = new Date();
  var x = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  var plain = '';
  const minlen = megs * 1024 * 1024;
  while(plain.length < minlen) {
    plain += x;
  }
  const cipher = forge.cipher.createCipher('AES-CBC', key);
  cipher.start({iv: iv});
  cipher.update(forge.util.createBuffer(plain));
  const result = cipher.finish();
  assert(result);
  const encrypted = cipher.output.getBytes();

  const time = (new Date() - start) / 1000;
  //console.log(`setup in ${time}s`);

  return {
    plain,
    encrypted,
    time
  };
}

function compareImpl() {
  const maxmegs = 20;
  let csv = '';
  // sweep input size
  for(let i = 1; i <= maxmegs; ++i) {
    const input = data(i);

    // forge w/ one chunk
    const tfs = [
      test_forge(input.encrypted),
      test_forge(input.encrypted),
      test_forge(input.encrypted)
    ];
    tfs.forEach(res => assert(input.plain == res.plain));
    const tf = tfs.reduce((prev, cur) => prev.time < cur.time ? prev : cur);

    // forge w/ chunks
    const blockSize = 1024 * 64;
    const tfcs = [
      test_forge_chunk(input.encrypted, blockSize),
      test_forge_chunk(input.encrypted, blockSize),
      test_forge_chunk(input.encrypted, blockSize)
    ];
    tfcs.forEach(res => assert(input.plain == res.plain));
    const tfc = tfcs.reduce((prev, cur) => prev.time < cur.time ? prev : cur);

    // node
    const tns = [
      test_node(input.encrypted),
      test_node(input.encrypted),
      test_node(input.encrypted)
    ];
    tns.forEach(res => assert(input.plain == res.plain));
    const tn = tns.reduce((prev, cur) => prev.time < cur.time ? prev : cur);

    csv += `${i}\t${tf.time}\t${i/tf.time}\t${tfc.time}\t${i/tfc.time}\t${tn.time}\t${i/tn.time}\t${tf.time/tn.time}\t${tfc.time/tn.time}\n`;
    console.log(`m:${i} tf:${tf.time} tf/s:${i/tf.time} tfc:${tfc.time} tfc/s:${i/tfc.time} tn:${tn.time} tn/s:${i/tn.time} sf:${tf.time/tn.time} sfc:${tfc.time/tn.time}`);
  }
  console.log(csv);
}

function compareBlockSize() {
  const megs = 10;
  let csv = '';
  const input = data(megs);
  function _test(k) {
    blockSize = 1024 * k;
    const tfcs = [
      test_forge_chunk(input.encrypted, blockSize),
      test_forge_chunk(input.encrypted, blockSize),
      test_forge_chunk(input.encrypted, blockSize)
    ];
    tfcs.forEach(res => assert(input.plain == res.plain));
    const tfc = tfcs.reduce((prev, cur) => prev.time < cur.time ? prev : cur);
    csv += `${k}\t${tfc.time}\t${megs/tfc.time}\n`;
    console.log(`k:${k} tfc:${tfc.time} tfc/s:${megs/tfc.time}`);
  }
  // sweek KB blockSize
  const sweep = [
    1,2,4,8,16,32,64,96,128,160,192,256,
    320,384,448,512,576,640,704,768,832,896,960,1024
  ];
  sweep.forEach(k => _test(k));
  console.log(csv);
}

compareImpl();
//compareBlockSize();
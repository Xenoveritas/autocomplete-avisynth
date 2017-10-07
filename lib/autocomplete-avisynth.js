"use strict";

let provider = null;

exports.provide = function() {
  if (provider === null) {
    const ap = require('./avisynth-provider');
    provider = new ap.AviSynthProvider();
  }
  return provider;
};

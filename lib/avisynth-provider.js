"use strict";

function prefixMatches(prefix, completion) {
  if (completion.length < prefix.length)
    return false;
  return completion.substring(0, prefix.length).localeCompare(prefix, "en", { "sensitivity": "accent" }) === 0;
}

/**
 * The provider for AviSynth itself.
 */
class AviSynthProvider {
  constructor() {
    let completions = require('../completions.json');
    this.control = completions.control;
    this.functions = completions.functions;
    this.variables = completions.variables;
    // Configure provider properties:
    // Target AVISynth
    this.selector = '.source.avs';
    this.disableForSelector = '.source.avs .comment';
    // Be a higher priority than the default provider which is 0
    this.inclusionPriority = 1;
    this.excludeLowerPriority = false;

    // Set ourselves to be a higher priority than the default
    this.suggestionPriority = 2;

    // Let autocomplete+ filter and sort the suggestions you provide.
    this.filterSuggestions = true;
  }

  // Required: Return a promise, an array of suggestions, or null.
  getSuggestions(options) {
    //{editor, bufferPosition, scopeDescriptor, prefix, activatedManually}
    //new Promise (resolve) ->
      // resolve([text: 'something'])
    if (options.prefix && options.prefix.length > 0) {
      let completions = [];
      for (let completion of this.functions) {
        if (prefixMatches(options.prefix, completion)) {
          completions.push({
            text: completion,
            // TODO: Use snippet for functions
            type: 'function',
            description: 'AviSynth built-in ' + completion
          });
        }
      }
      for (let completion of this.variables) {
        if (prefixMatches(options.prefix, completion)) {
          completions.push({
            text: completion,
            type: 'variable',
            description: 'AviSynth built-in ' + completion
          });
        }
      }
      return completions;
    }
    return null;
  }

  //onDidInsertSuggestion: ({editor, triggerPosition, suggestion}) ->

  // Do any cleanup (there isn't any yet)
  //dispose() { }
}

exports.AviSynthProvider = AviSynthProvider;

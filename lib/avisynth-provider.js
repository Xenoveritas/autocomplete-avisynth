"use strict";

function prefixMatches(prefix, completion) {
  if (completion.length < prefix.length)
    return false;
  return completion.substring(0, prefix.length).localeCompare(prefix, "en", { "sensitivity": "accent" }) === 0;
}

/**
 * Forms a completion based on JSON.
 */
class Completion {
  constructor(json, type, wiki) {
    if (typeof json === 'string') {
      // String means we have a name and no other data.
      this.text = json;
      this.description = 'AviSynth built-in';
    } else {
      // Otherwise, grab the properties out of the JSON
      this.text = json['text'];
      if ('description' in json)
        this.description = json['description'];
      if (json['wiki']) {
        if (json['wiki'] === true)
          this.descriptionMoreURL = wiki + this.text;
        else
          this.descriptionMoreURL = wiki + json['wiki'];
      }
      if ('descriptionMoreURL' in json)
        this.descriptionMoreURL = json['descriptionMoreURL'];
      this.returns = json['returns'];
    }
    this.type = type;
  }
  matches(prefix) {
    if (this.text.length < prefix.length)
      return false;
    return this.text.substring(0, prefix.length).localeCompare(prefix, "en", { "sensitivity": "accent" }) === 0;
  }
  toCompletion() {
    return {
      text: this.text,
      type: this.type,
      description: this.description,
      descriptionMoreURL: this.descriptionMoreURL,
      leftLabel: this.returns
    };
  }
}

/**
 * The provider for AviSynth itself.
 */
class AviSynthProvider {
  constructor() {
    let completions = require('../completions.json');
    let wiki = completions['wiki'];
    this.control = completions.control;
    this.functions = completions.functions.map(definition => {
      return new Completion(definition, 'function', wiki);
    });
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
      for (let func of this.functions) {
        if (func.matches(options.prefix)) {
          completions.push(func.toCompletion());
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

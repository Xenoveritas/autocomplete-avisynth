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
      this.description = 'AviSynth built-in ' + type;
      this.priority = 0;
      this.abbreviated = true;
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
      if ('signature' in json) {
        if (json['signature'] === '') {
          this.snippet = '()';
        } else {
          // Parse the signature.
          let fields = json['signature'].split(/\s*,\s*/).map((field, index) => {
            let m = /^(\[?)(\w+\s+\w+|\w+)(=.*)?(\.{3})?(\]?)$/.exec(field);
            if (m) {
              // Each individual value may or may not have a type
              let name = m[2];
              m = /^(\w+)\s+(\w+)$/.exec(name);
              if (m) {
                name = m[2];
              }
              return '${' + (index+1) + ':' + name + '}';
            } else {
              console.log("Could not parse " + this.text + " field " + field);
              return field;
            }
          });
          this.snippet = '(' + fields.join(', ') + ')';
        }
      }
    }
    this.type = type;
  }
  /**
   * Given a prefix, returns a completion if the prefix matches. If no prefixes
   * match, this returns null.
   *
   * Note that this will only return one prefix. If multiple aliases match the
   * prefix, only the first will be used.
   */
  matchingCompletion(prefix) {
    // Text may be an array. If it is, we might return multiple matching
    // completions.
    if (this.text.find) {
      let match = this.text.find(text => { return prefixMatches(prefix, text); });
      if (match) {
        return this.toCompletion(match);
      }
    } else {
      if (prefixMatches(prefix, this.text)) {
        return this.toCompletion(this.text);
      }
    }
    return null;
  }
  toCompletion(text) {
    let completion = {
      type: this.type,
      description: this.description,
      descriptionMoreURL: this.descriptionMoreURL,
      leftLabel: this.returns,
      rightLabel: this.signature
    };
    if (this.snippet) {
      // Use the snippet instead
      completion.snippet = text + this.snippet;
    } else {
      completion.text = text;
    }
    return completion;
  }
}

/**
 * The provider for AviSynth itself.
 */
class AviSynthProvider {
  constructor() {
    this._completions = {};
    let completions = require('../completions.json');
    let wiki = completions['wiki'];
    this.control = completions.control;
    this.fullCount = 0;
    this.abbreviatedCount = 0;
    completions.functions.forEach(definition => {
      this.registerCompletion(new Completion(definition, 'function', wiki));
    });
    completions.variables.forEach(definition => {
      this.registerCompletion(new Completion(definition, 'variable', wiki));
    });
    let total = this.fullCount + this.abbreviatedCount;
    let percent = (this.abbreviatedCount / total * 100);
    console.log(`Loaded ${total} completions, ${this.fullCount} full completions, ${this.abbreviatedCount} abbreviated (${percent.toFixed(1)}%).`);
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

  /**
   * Registers a completion object.
   */
  registerCompletion(completion) {
    if (completion.abbreviated) {
      this.abbreviatedCount++;
    } else {
      this.fullCount++;
    }
    if (completion.text.forEach) {
      // Multiple names (some functions have aliases)
      // Each completion should only be added to each letter once. Because
      // there aren't a lot of functions with aliases, check backwards for
      // each name to see if the letter has already been added.
      completion.text.forEach((name, index) => {
        let letter = name[0].toLowerCase();
        if (index > 0) {
          // Make sure this letter hasn't already been added
          for (let i = 0; i < index; i++) {
            if (letter == completion.text[i][0].toLowerCase()) {
              // Exit out of this forEach handler entirely
              return;
            }
          }
        }
        this._registerCompletion(name, completion);
      });
    } else {
      this._registerCompletion(completion.text, completion);
    }
  }

  _registerCompletion(name, completion) {
    let letter = name[0].toLowerCase();
    if (!(letter in this._completions)) {
      this._completions[letter] = [];
    }
    this._completions[letter].push(completion);
  }

  // Required: Return a promise, an array of suggestions, or null.
  getSuggestions(options) {
    //{editor, bufferPosition, scopeDescriptor, prefix, activatedManually}
    let prefix = options.prefix;
    // First figure out what context we're in. We could be:
    //  * Just generally in the file, so all functions/variables/control
    //    keywords apply
    //  * Somewhere after "function name(" but before ")", so complete types
    //  * Somewhere after a ".", so complete only clip functions
    if (prefix && prefix.length > 0) {
      let letter = prefix[0].toLowerCase();
      if (letter in this._completions) {
        let completions = [], possibles = this._completions[letter];
        possibles.forEach(possible => {
          let result = possible.matchingCompletion(prefix);
          if (result !== null) {
            completions.push(result);
          }
        });
        return completions;
      }
    }
    return null;
  }

  //onDidInsertSuggestion: ({editor, triggerPosition, suggestion}) ->

  // Do any cleanup (there isn't any yet)
  //dispose() { }
}

exports.AviSynthProvider = AviSynthProvider;

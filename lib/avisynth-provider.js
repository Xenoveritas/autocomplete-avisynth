"use strict";

const completiondb = require('./completiondb');

/**
 * The provider for AviSynth itself.
 */
class AviSynthProvider {
  constructor() {
    // Configure provider properties:
    // Target AVISynth
    this.selector = '.source.avs';
    // For now, disable for comments and user function names
    this.disableForSelector = '.source.avs .comment, .source.avs .entity.name.function.avs';
    // Be a higher priority than the default provider which is 0
    this.inclusionPriority = 1;
    this.excludeLowerPriority = false;

    // Set ourselves to be a higher priority than the default
    this.suggestionPriority = 2;

    // Currently let autocomplete-plus sort and filter suggestions. This causes
    // things to end up in a weird order, but ... whatever.
    this.filterSuggestions = true;
  }

  // Required: Return a promise, an array of suggestions, or null.
  getSuggestions(options) {
    //{editor, bufferPosition, scopeDescriptor, prefix, activatedManually}
    const editor = options.editor, position = options.bufferPosition,
      scopeDescriptor = options.scopeDescriptor, prefix = options.prefix;
    // There are a couple of scopes
    // Grab the line before this so we can figure out what we're doing.
    let line = editor.getBuffer().lineForRow(position.row);
    // TODO: check the previous line to see if this line is a continuation
    let lineBefore = line.substring(0, position.column - prefix.length);
    // Figure out what context we're in. We could be:
    //  * Just generally in the file, so all functions/variables/control
    //    keywords apply
    //  * Somewhere after "function name(" but before ")", so complete types
    //  * Somewhere after a ".", so complete only clip functions
    if (/^\s*function\s*\w+\s*/.test(lineBefore)) {
      // Potentially inside a function declaration. There are two possibles
      // here: inside the arguments definition, or outside it (but with a
      // prefix that's preparing for it)
      if (/^\s*(\(|,\s)\s*$/.test(prefix)) {
        console.log("All completions");
        // Do a type completion for all types
        return completiondb.typeContext.allCompletions(prefix);
      } else if (/[\(,]\s*$/.test(lineBefore)) {
        // Do a type completion
        return completiondb.typeContext.findCompletions(prefix);
      } else {
        // Should be a name
        return null;
      }
    } else if (/\.\s*$/.test(lineBefore)) {
      // Autocomplete functions that take a clip as the first argument.
      return completiondb.clipContext.findCompletions(prefix, 'clip');
    } else if (/^\.\s*$/.test(prefix)) {
      // This is an interesting case - this is after a "." but before any
      // letters have been typed. It should autocomplete to the most likely
      // clip functions.
      // FIXME: For now, return nothing.
      return null;
    }
    return completiondb.rootContext.findCompletions(prefix);
  }

  //onDidInsertSuggestion: ({editor, triggerPosition, suggestion}) ->

  // Do any cleanup (there isn't any yet)
  //dispose() { }
}

exports.AviSynthProvider = AviSynthProvider;

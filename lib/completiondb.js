/**
 * Module for looking up specific completions.
 */

/**
 * Utility for seeing if the start of a string matches a given prefix.
 * @param {String} prefix the beginning of a string
 * @param {String} completion the complete string to see if it matches
 */
function prefixMatches(prefix, completion) {
  if (completion.length < prefix.length)
    return false;
  return completion.substring(0, prefix.length).localeCompare(prefix, "en", { "sensitivity": "accent" }) === 0;
}

/**
* A single argument in a signature.
*/
class Argument {
  constructor(argumentString) {
    let m = /^(\[?)(\w+\s+\w+|\w+)(=.*)?(\.{3})?(\]?)$/.exec(argumentString);
    if (m) {
      // Each individual value may or may not have a type
      this.name = m[2];
      m = /^(\w+)\s+(\w+)$/.exec(this.name);
      if (m) {
        this.type = m[1];
        this.name = m[2];
      } else {
        // Type and name are one and the same
        this.type = this.name;
      }
    } else {
    throw new Error(`Could not parse field "${argumentString}"`);
    }
  }
  toSnippetField(index) {
    return "${" + index + ":" + this.name + "}";
  }
}

 /**
  * Represents one (or more) signatures for a function.
  */
 class Signature {
   constructor(signature) {
    // For now, only parse the first one if given an array
    if (typeof signature !== 'string' && typeof signature.forEach === 'function') {
      signature = signature[0];
    }
    if (/^\s*$/.test(signature)) {
      this.args = [];
    } else {
      this.args = signature.split(/\s*,\s*/).map(str => {
        return new Argument(str);
      });
    }
    let snippetArgs = this.args.map((arg, index) => {
      return arg.toSnippetField(index + 1);
    });
    this.takesClip = this.args.length > 0 && this.args[0].type === 'clip';
    this.snippet = "(" + snippetArgs.join(', ') + ")";
    if (this.takesClip) {
      this.clipSnippet = "(" + snippetArgs.slice(1).join(', ') + ")";
    }
  }
  toSnippet() {
    return this.snippet;
  }
  toClipSnippet() {
    return this.clipSnippet;
  }
}

/**
 * Forms a completion based on JSON. The JSON definition of completions is as
 * follows:
 *
 * "text": either an array of values, in order of "correctness", or just a
 *   string. If an array, only the earliest item will be completed if multiple
 *   match.
 * "description": text displayed in the description field
 * "signature": describes the signature
 * "returns": indicates what the clip returns
 * "wiki": if present, overrides the "More.." link. If false, indicates there is
 *   no Wiki entry
 */
class Completion {
  constructor(json, type, wiki) {
    if (typeof json !== 'object' || !('text' in json))
      throw new Error("Bad completion definition " + JSON.stringify(json));
    this.text = json['text'];
    if ('description' in json) {
      this.description = json['description'];
    } else {
      // This should no longer happen but leave it in anyway
      this.description = 'AVISynth built-in ' + type + ' ' + this.text;
      this.abbreviated = true;
      console.log("Warning: missing description for " + this.text);
    }
    if (typeof json['wiki'] === 'string') {
      this.descriptionMoreURL = wiki + json['wiki'];
    } else if (json['wiki'] === false) {
      // Indicates that there is legitimately no Wiki entry for this.
      // This is fairly rare.
      this.descriptionMoreURL = null;
    } else {
      this.descriptionMoreURL = wiki + this.text;
    }
    if ('descriptionMoreURL' in json)
      this.descriptionMoreURL = json['descriptionMoreURL'];
    this.returns = json['returns'];
    if ('signature' in json) {
      this.signature = new Signature(json['signature']);
      this.snippet = this.signature.toSnippet();
      this.takesClip = this.signature.takesClip;
      this.clipSnippet = this.signature.toClipSnippet();
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
  matchingCompletion(prefix, context) {
    // Text may be an array. If it is, we might return multiple matching
    // completions.
    if (this.text.find) {
      let match = this.text.find(text => { return prefixMatches(prefix, text); });
      if (match) {
        return this.toCompletion(match, context);
      }
    } else {
      if (prefixMatches(prefix, this.text)) {
        return this.toCompletion(this.text, context);
      }
    }
    return null;
  }
  toCompletion(text, context) {
    if (arguments.length === 0) {
      text = this.text;
      // If an array, go with the first one
      if (typeof text !== 'string')
        text = text[0];
    }
    let completion = {
      type: this.type,
      description: this.description,
      descriptionMoreURL: this.descriptionMoreURL,
      leftLabel: this.returns
    };
    if (this.snippet) {
      // Use the snippet instead
      if (context === 'clip') {
        completion.snippet = text + this.clipSnippet;
      } else {
        completion.snippet = text + this.snippet;
      }
    } else {
      completion.text = text;
    }
    return completion;
  }
}

/**
 * Database of completions. It is expected that there will be multiple instances
 * for different scenarios.
 */
class CompletionDB {
  constructor() {
    /**
     * Object containing completions separated by first letters.
     */
    this._completions = {};
    /**
     * All completions.
     */
    this._all = [];
  }

  /**
   * Registers a completion object.
   */
  registerCompletion(completion) {
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
    this._all.push(completion);
  }

  _registerCompletion(name, completion) {
    let letter = name[0].toLowerCase();
    if (!(letter in this._completions)) {
      this._completions[letter] = [];
    }
    this._completions[letter].push(completion);
  }

  allCompletions(replacement) {
    let rv = this._all.map(completion => {
      return completion.toCompletion();
    });
    if (arguments.length > 1) {
      rv.forEach(completion => {
        completion.replacementPrefix = replacement;
      });
    }
    return rv;
  }

  findCompletions(prefix, context) {
    if (prefix.length < 1)
      return null;
    let letter = prefix[0].toLowerCase();
    if (letter in this._completions) {
      let completions = [];
      this._completions[letter].forEach(possible => {
        let result = possible.matchingCompletion(prefix, context);
        if (result !== null) {
          completions.push(result);
        }
      });
      // Currently completions come out in the order they appear in the
      // enormous completion JSON. There will eventually be a priority field
      // to determine "most likely" completions, but for now, just sort
      // alphabetically.
      completions.sort((a, b) => {
        return (a.text ? a.text : a.snippet).localeCompare(
          b.text ? b.text : b.snippet, "en", { "sensitivity": "accent" });
      });
      return completions;
    }
    return null;
  }
}

// Load completions.

const rootContext = new CompletionDB(),
  clipContext = new CompletionDB(),
  typeContext = new CompletionDB();

exports.rootContext = rootContext;
exports.clipContext = clipContext;
exports.typeContext = typeContext;

/**
 * Given a set of completions, parses them into separate DBs.
 */
function parseCompletions(json) {
  const wiki = json.wiki;
  json.functions.forEach(definition => {
    let completion = new Completion(definition, 'function', wiki);
    rootContext.registerCompletion(completion);
    if (completion.takesClip)
      clipContext.registerCompletion(completion);
  });
  json.variables.forEach(definition => {
    rootContext.registerCompletion(new Completion(definition, 'variable', wiki));
  });
  json.types.forEach(definition => {
    typeContext.registerCompletion(new Completion(definition, 'type', wiki));
  });
}

parseCompletions(require('../completions.json'));

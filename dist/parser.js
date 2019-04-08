'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = function (buffers) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var parser = new ParserInstance(buffers, options);
  var response = {};

  response.tag = parser.getTag();
  parser.getSpace();
  response.command = parser.getCommand();

  if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
    parser.getSpace();
    response.command += ' ' + parser.getElement((0, _formalSyntax.COMMAND)());
  }

  if (!isEmpty(parser.remainder)) {
    parser.getSpace();
    response.attributes = parser.getAttributes();
  }

  if (parser.humanReadable) {
    response.attributes = (response.attributes || []).concat({
      type: 'TEXT',
      value: parser.humanReadable
    });
  }

  return response;
};

var _formalSyntax = require('./formal-syntax');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ASCII_NL = 10;
var ASCII_CR = 13;
var ASCII_SPACE = 32;
var ASCII_LEFT_BRACKET = 91;
var ASCII_RIGHT_BRACKET = 93;

function fromCharCode(uint8Array) {
  var batchSize = 10240;
  var strings = [];

  for (var i = 0; i < uint8Array.length; i += batchSize) {
    var begin = i;
    var end = Math.min(i + batchSize, uint8Array.length);
    strings.push(String.fromCharCode.apply(null, uint8Array.subarray(begin, end)));
  }

  return strings.join('');
}

function fromCharCodeTrimmed(uint8Array) {
  var begin = 0;
  var end = uint8Array.length;

  while (uint8Array[begin] === ASCII_SPACE) {
    begin++;
  }

  while (uint8Array[end - 1] === ASCII_SPACE) {
    end--;
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end);
  }

  return fromCharCode(uint8Array);
}

function isEmpty(uint8Array) {
  for (var i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== ASCII_SPACE) {
      return false;
    }
  }

  return true;
}

var ParserInstance = function () {
  function ParserInstance(input, options) {
    _classCallCheck(this, ParserInstance);

    this.remainder = new Uint8Array(input || 0);
    this.options = options || {};
    this.pos = 0;
  }

  _createClass(ParserInstance, [{
    key: 'getTag',
    value: function getTag() {
      if (!this.tag) {
        this.tag = this.getElement((0, _formalSyntax.TAG)() + '*+', true);
      }
      return this.tag;
    }
  }, {
    key: 'getCommand',
    value: function getCommand() {
      if (!this.command) {
        this.command = this.getElement((0, _formalSyntax.COMMAND)());
      }

      switch ((this.command || '').toString().toUpperCase()) {
        case 'OK':
        case 'NO':
        case 'BAD':
        case 'PREAUTH':
        case 'BYE':
          var lastRightBracket = this.remainder.lastIndexOf(ASCII_RIGHT_BRACKET);
          if (this.remainder[1] === ASCII_LEFT_BRACKET && lastRightBracket > 1) {
            this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(lastRightBracket + 1));
            this.remainder = this.remainder.subarray(0, lastRightBracket + 1);
          } else {
            this.humanReadable = fromCharCodeTrimmed(this.remainder);
            this.remainder = new Uint8Array(0);
          }
          break;
      }

      return this.command;
    }
  }, {
    key: 'getElement',
    value: function getElement(syntax) {
      var element = void 0;
      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      var firstSpace = this.remainder.indexOf(ASCII_SPACE);
      if (this.remainder.length > 0 && firstSpace !== 0) {
        if (firstSpace === -1) {
          element = fromCharCode(this.remainder);
        } else {
          element = fromCharCode(this.remainder.subarray(0, firstSpace));
        }

        var errPos = (0, _formalSyntax.verify)(element, syntax);
        if (errPos >= 0) {
          throw new Error('Unexpected char at position ' + (this.pos + errPos));
        }
      } else {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      this.pos += element.length;
      this.remainder = this.remainder.subarray(element.length);

      return element;
    }
  }, {
    key: 'getSpace',
    value: function getSpace() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if ((0, _formalSyntax.verify)(String.fromCharCode(this.remainder[0]), (0, _formalSyntax.SP)()) >= 0) {
        throw new Error('Unexpected char at position ' + this.pos);
      }

      this.pos++;
      this.remainder = this.remainder.subarray(1);
    }
  }, {
    key: 'getAttributes',
    value: function getAttributes() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      return new TokenParser(this, this.pos, this.remainder.subarray(), this.options).getAttributes();
    }
  }]);

  return ParserInstance;
}();

var Node = function () {
  function Node(uint8Array, parentNode, startPos) {
    _classCallCheck(this, Node);

    this.uint8Array = uint8Array;
    this.childNodes = [];
    this.type = false;
    this.closed = true;
    this.valueSkip = [];
    this.startPos = startPos;
    this.valueStart = this.valueEnd = typeof startPos === 'number' ? startPos + 1 : 0;

    if (parentNode) {
      this.parentNode = parentNode;
      parentNode.childNodes.push(this);
    }
  }

  _createClass(Node, [{
    key: 'getValue',
    value: function getValue() {
      var value = fromCharCode(this.getValueArray());
      return this.valueToUpperCase ? value.toUpperCase() : value;
    }
  }, {
    key: 'getValueLength',
    value: function getValueLength() {
      return this.valueEnd - this.valueStart - this.valueSkip.length;
    }
  }, {
    key: 'getValueArray',
    value: function getValueArray() {
      var valueArray = this.uint8Array.subarray(this.valueStart, this.valueEnd);

      if (this.valueSkip.length === 0) {
        return valueArray;
      }

      var filteredArray = new Uint8Array(valueArray.length - this.valueSkip.length);
      var begin = 0;
      var offset = 0;
      var skip = this.valueSkip.slice();

      skip.push(valueArray.length);

      skip.forEach(function (end) {
        if (end > begin) {
          var subArray = valueArray.subarray(begin, end);
          filteredArray.set(subArray, offset);
          offset += subArray.length;
        }
        begin = end + 1;
      });

      return filteredArray;
    }
  }, {
    key: 'equals',
    value: function equals(value, caseSensitive) {
      if (this.getValueLength() !== value.length) {
        return false;
      }

      return this.equalsAt(value, 0, caseSensitive);
    }
  }, {
    key: 'equalsAt',
    value: function equalsAt(value, index, caseSensitive) {
      caseSensitive = typeof caseSensitive === 'boolean' ? caseSensitive : true;

      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;
      }

      for (var i = 0; i < value.length; i++) {
        while (this.valueSkip.indexOf(index - this.valueStart) >= 0) {
          index++;
        }

        if (index >= this.valueEnd) {
          return false;
        }

        var uint8Char = String.fromCharCode(this.uint8Array[index]);
        var char = value[i];

        if (!caseSensitive) {
          uint8Char = uint8Char.toUpperCase();
          char = char.toUpperCase();
        }

        if (uint8Char !== char) {
          return false;
        }

        index++;
      }

      return true;
    }
  }, {
    key: 'isNumber',
    value: function isNumber() {
      for (var i = 0; i < this.valueEnd - this.valueStart; i++) {
        if (this.valueSkip.indexOf(i) >= 0) {
          continue;
        }

        if (!this.isDigit(i)) {
          return false;
        }
      }

      return true;
    }
  }, {
    key: 'isDigit',
    value: function isDigit(index) {
      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index++;
        }
      }

      var ascii = this.uint8Array[index];
      return ascii >= 48 && ascii <= 57;
    }
  }, {
    key: 'containsChar',
    value: function containsChar(char) {
      var ascii = char.charCodeAt(0);

      for (var i = this.valueStart; i < this.valueEnd; i++) {
        if (this.valueSkip.indexOf(i - this.valueStart) >= 0) {
          continue;
        }

        if (this.uint8Array[i] === ascii) {
          return true;
        }
      }

      return false;
    }
  }]);

  return Node;
}();

var TokenParser = function () {
  function TokenParser(parent, startPos, uint8Array) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, TokenParser);

    this.uint8Array = uint8Array;
    this.options = options;
    this.parent = parent;

    this.tree = this.currentNode = this.createNode();
    this.pos = startPos || 0;

    this.currentNode.type = 'TREE';

    this.state = 'NORMAL';

    if (this.options.valueAsString === undefined) {
      this.options.valueAsString = true;
    }

    this.processString(parent.command);
  }

  _createClass(TokenParser, [{
    key: 'getAttributes',
    value: function getAttributes() {
      var _this = this;

      var attributes = [];
      var branch = attributes;

      var walk = function walk(node) {
        var elm = void 0;
        var curBranch = branch;
        var partial = void 0;

        if (!node.closed && node.type === 'SEQUENCE' && node.equals('*')) {
          node.closed = true;
          node.type = 'ATOM';
        }

        // If the node was never closed, throw it
        if (!node.closed) {
          throw new Error('Unexpected end of input at position ' + (_this.pos + _this.uint8Array.length - 1));
        }

        switch (node.type.toUpperCase()) {
          case 'LITERAL':
          case 'STRING':
            elm = {
              type: node.type.toUpperCase(),
              value: _this.options.valueAsString ? node.getValue() : node.getValueArray()
            };
            branch.push(elm);
            break;
          case 'SEQUENCE':
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'ATOM':
            if (node.equals('NIL', true)) {
              branch.push(null);
              break;
            }
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'SECTION':
            branch = branch[branch.length - 1].section = [];
            break;
          case 'LIST':
            elm = [];
            branch.push(elm);
            branch = elm;
            break;
          case 'PARTIAL':
            partial = node.getValue().split('.').map(Number);
            branch[branch.length - 1].partial = partial;
            break;
        }

        node.childNodes.forEach(function (childNode) {
          walk(childNode);
        });
        branch = curBranch;
      };

      walk(this.tree);

      return attributes;
    }
  }, {
    key: 'createNode',
    value: function createNode(parentNode, startPos) {
      return new Node(this.uint8Array, parentNode, startPos);
    }
  }, {
    key: 'processString',
    value: function processString(command) {
      var _this2 = this;

      var i = void 0;
      var len = void 0;
      var checkSP = function checkSP(pos) {
        // jump to the next non whitespace pos
        while (_this2.uint8Array[i + 1] === ' ') {
          i++;
        }
      };

      // skip normal parser if SEARCH for better parsing performance
      if (command === "SEARCH") {
        var string = new TextDecoder("utf-8").decode(this.uint8Array);
        var parts = string.split(' ');
        var arrayLength = parts.length;
        var ipos = 0;
        for (i = 0; i < arrayLength; i++) {
          this.currentNode = this.createNode(this.currentNode, ipos);
          this.currentNode.type = 'ATOM';
          this.currentNode.valueStart = ipos;
          this.currentNode.startPos = ipos;
          ipos += parts[i].length;
          this.currentNode.endPos = ipos;
          this.currentNode.valueEnd = ipos;
          ipos += 1;
          this.currentNode = this.currentNode.parentNode;
        }
        return;
      }

      for (i = 0, len = this.uint8Array.length; i < len; i++) {
        var chr = String.fromCharCode(this.uint8Array[i]);

        switch (this.state) {
          case 'NORMAL':

            switch (chr) {
              // DQUOTE starts a new string
              case '"':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'string';
                this.state = 'STRING';
                this.currentNode.closed = false;
                break;

              // ( starts a new list
              case '(':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                break;

              // ) closes a list
              case ')':
                if (this.currentNode.type !== 'LIST') {
                  throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                }

                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;

                checkSP();
                break;

              // ] closes section group
              case ']':
                if (this.currentNode.type !== 'SECTION') {
                  throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                checkSP();
                break;

              // < starts a new partial
              case '<':
                if (String.fromCharCode(this.uint8Array[i - 1]) !== ']') {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';
                  this.currentNode.valueStart = i;
                  this.currentNode.valueEnd = i + 1;
                  this.state = 'ATOM';
                } else {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'PARTIAL';
                  this.state = 'PARTIAL';
                  this.currentNode.closed = false;
                }
                break;

              // { starts a new literal
              case '{':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LITERAL';
                this.state = 'LITERAL';
                this.currentNode.closed = false;
                break;

              // ( starts a new sequence
              case '*':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'SEQUENCE';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.currentNode.closed = false;
                this.state = 'SEQUENCE';
                break;

              // normally a space should never occur
              case ' ':
                // just ignore
                break;

              // [ starts section
              case '[':
                // If it is the *first* element after response command, then process as a response argument list
                if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                  this.currentNode.endPos = this.pos + i;

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'SECTION';
                  this.currentNode.closed = false;
                  this.state = 'NORMAL';

                  // RFC2221 defines a response code REFERRAL whose payload is an
                  // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
                  // fail quite badly at parsing.  Since the imapurl is such a unique
                  // (and crazy) term, we just specialize that case here.
                  if (fromCharCode(this.uint8Array.subarray(i + 1, i + 10)).toUpperCase() === 'REFERRAL ') {
                    // create the REFERRAL atom
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 1);
                    this.currentNode.type = 'ATOM';
                    this.currentNode.endPos = this.pos + i + 8;
                    this.currentNode.valueStart = i + 1;
                    this.currentNode.valueEnd = i + 9;
                    this.currentNode.valueToUpperCase = true;
                    this.currentNode = this.currentNode.parentNode;

                    // eat all the way through the ] to be the  IMAPURL token.
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 10);
                    // just call this an ATOM, even though IMAPURL might be more correct
                    this.currentNode.type = 'ATOM';
                    // jump i to the ']'
                    i = this.uint8Array.indexOf(ASCII_RIGHT_BRACKET, i + 10);
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode.valueStart = this.currentNode.startPos - this.pos;
                    this.currentNode.valueEnd = this.currentNode.endPos - this.pos + 1;
                    this.currentNode = this.currentNode.parentNode;

                    // close out the SECTION
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    checkSP();
                  }

                  break;
                }
              /* falls through */
              default:
                // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                // Allow \ as the first char for atom to support system flags
                // Allow % to support LIST '' %
                if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== '\\' && chr !== '%') {
                  throw new Error('Unexpected char at position ' + (this.pos + i));
                }

                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'ATOM';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.state = 'ATOM';
                break;
            }
            break;

          case 'ATOM':

            // space finishes an atom
            if (chr === ' ') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            }

            //
            if (this.currentNode.parentNode && (chr === ')' && this.currentNode.parentNode.type === 'LIST' || chr === ']' && this.currentNode.parentNode.type === 'SECTION')) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if ((chr === ',' || chr === ':') && this.currentNode.isNumber()) {
              this.currentNode.type = 'SEQUENCE';
              this.currentNode.closed = true;
              this.state = 'SEQUENCE';
            }

            // [ starts a section group for this element
            if (chr === '[' && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
              this.currentNode.type = 'SECTION';
              this.currentNode.closed = false;
              this.state = 'NORMAL';
              break;
            }

            if (chr === '<') {
              throw new Error('Unexpected start of partial at position ' + this.pos);
            }

            // if the char is not ATOM compatible, throw. Allow \* as an exception
            if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== ']' && !(chr === '*' && this.currentNode.equals('\\'))) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            } else if (this.currentNode.equals('\\*')) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'STRING':

            // DQUOTE ends the string sequence
            if (chr === '"') {
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            // \ Escapes the following char
            if (chr === '\\') {
              this.currentNode.valueSkip.push(i - this.currentNode.valueStart);
              i++;
              if (i >= len) {
                throw new Error('Unexpected end of input at position ' + (this.pos + i));
              }
              chr = String.fromCharCode(this.uint8Array[i]);
            }

            /* // skip this check, otherwise the parser might explode on binary input
            if (TEXT_CHAR().indexOf(chr) < 0) {
                throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            */

            this.currentNode.valueEnd = i + 1;
            break;

          case 'PARTIAL':
            if (chr === '>') {
              if (this.currentNode.equalsAt('.', -1)) {
                throw new Error('Unexpected end of partial at position ' + this.pos);
              }
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              checkSP();
              break;
            }

            if (chr === '.' && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
              throw new Error('Unexpected partial separator . at position ' + this.pos);
            }

            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0 && chr !== '.') {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (chr !== '.' && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
              throw new Error('Invalid partial at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'LITERAL':
            if (this.currentNode.started) {
              if (chr === '\0') {
                throw new Error('Unexpected \\x00 at position ' + (this.pos + i));
              }
              this.currentNode.valueEnd = i + 1;

              if (this.currentNode.getValueLength() >= this.currentNode.literalLength) {
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }

            if (chr === '+' && this.options.literalPlus) {
              this.currentNode.literalPlus = true;
              break;
            }

            if (chr === '}') {
              if (!('literalLength' in this.currentNode)) {
                throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
              }
              if (this.uint8Array[i + 1] === ASCII_NL) {
                i++;
              } else if (this.uint8Array[i + 1] === ASCII_CR && this.uint8Array[i + 2] === ASCII_NL) {
                i += 2;
              } else {
                throw new Error('Unexpected char at position ' + (this.pos + i));
              }
              this.currentNode.valueStart = i + 1;
              this.currentNode.literalLength = Number(this.currentNode.literalLength);
              this.currentNode.started = true;

              if (!this.currentNode.literalLength) {
                // special case where literal content length is 0
                // close the node right away, do not wait for additional input
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }
            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            if (this.currentNode.literalLength === '0') {
              throw new Error('Invalid literal at position ' + (this.pos + i));
            }
            this.currentNode.literalLength = (this.currentNode.literalLength || '') + chr;
            break;

          case 'SEQUENCE':
            // space finishes the sequence set
            if (chr === ' ') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            } else if (this.currentNode.parentNode && chr === ']' && this.currentNode.parentNode.type === 'SECTION') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if (chr === ':') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected range separator : at position ' + (this.pos + i));
              }
            } else if (chr === '*') {
              if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
                throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
              }
            } else if (chr === ',') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
            } else if (!/\d/.test(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (/\d/.test(chr) && this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected number at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;
        }
      }
    }
  }]);

  return TokenParser;
}();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJpc0VtcHR5IiwicmVtYWluZGVyIiwiYXR0cmlidXRlcyIsImdldEF0dHJpYnV0ZXMiLCJodW1hblJlYWRhYmxlIiwiY29uY2F0IiwidHlwZSIsInZhbHVlIiwiQVNDSUlfTkwiLCJBU0NJSV9DUiIsIkFTQ0lJX1NQQUNFIiwiQVNDSUlfTEVGVF9CUkFDS0VUIiwiQVNDSUlfUklHSFRfQlJBQ0tFVCIsImZyb21DaGFyQ29kZSIsInVpbnQ4QXJyYXkiLCJiYXRjaFNpemUiLCJzdHJpbmdzIiwiaSIsImxlbmd0aCIsImJlZ2luIiwiZW5kIiwiTWF0aCIsIm1pbiIsInB1c2giLCJTdHJpbmciLCJhcHBseSIsInN1YmFycmF5Iiwiam9pbiIsImZyb21DaGFyQ29kZVRyaW1tZWQiLCJpbnB1dCIsIlVpbnQ4QXJyYXkiLCJwb3MiLCJ0b1N0cmluZyIsImxhc3RSaWdodEJyYWNrZXQiLCJsYXN0SW5kZXhPZiIsInN5bnRheCIsImVsZW1lbnQiLCJFcnJvciIsImZpcnN0U3BhY2UiLCJlcnJQb3MiLCJUb2tlblBhcnNlciIsIk5vZGUiLCJwYXJlbnROb2RlIiwic3RhcnRQb3MiLCJjaGlsZE5vZGVzIiwiY2xvc2VkIiwidmFsdWVTa2lwIiwidmFsdWVTdGFydCIsInZhbHVlRW5kIiwiZ2V0VmFsdWVBcnJheSIsInZhbHVlVG9VcHBlckNhc2UiLCJ2YWx1ZUFycmF5IiwiZmlsdGVyZWRBcnJheSIsIm9mZnNldCIsInNraXAiLCJzbGljZSIsImZvckVhY2giLCJzdWJBcnJheSIsInNldCIsImNhc2VTZW5zaXRpdmUiLCJnZXRWYWx1ZUxlbmd0aCIsImVxdWFsc0F0IiwiaW5kZXgiLCJ1aW50OENoYXIiLCJjaGFyIiwiaXNEaWdpdCIsImFzY2lpIiwiY2hhckNvZGVBdCIsInBhcmVudCIsInRyZWUiLCJjdXJyZW50Tm9kZSIsImNyZWF0ZU5vZGUiLCJzdGF0ZSIsInZhbHVlQXNTdHJpbmciLCJ1bmRlZmluZWQiLCJwcm9jZXNzU3RyaW5nIiwiYnJhbmNoIiwid2FsayIsImVsbSIsImN1ckJyYW5jaCIsInBhcnRpYWwiLCJub2RlIiwiZXF1YWxzIiwiZ2V0VmFsdWUiLCJzZWN0aW9uIiwic3BsaXQiLCJtYXAiLCJOdW1iZXIiLCJjaGlsZE5vZGUiLCJsZW4iLCJjaGVja1NQIiwic3RyaW5nIiwiVGV4dERlY29kZXIiLCJkZWNvZGUiLCJwYXJ0cyIsImFycmF5TGVuZ3RoIiwiaXBvcyIsImVuZFBvcyIsImNociIsImlzTnVtYmVyIiwiY29udGFpbnNDaGFyIiwic3RhcnRlZCIsImxpdGVyYWxMZW5ndGgiLCJsaXRlcmFsUGx1cyIsInRlc3QiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O2tCQXV5QmUsVUFBVUEsT0FBVixFQUFpQztBQUFBLE1BQWRDLE9BQWMsdUVBQUosRUFBSTs7QUFDOUMsTUFBSUMsU0FBUyxJQUFJQyxjQUFKLENBQW1CSCxPQUFuQixFQUE0QkMsT0FBNUIsQ0FBYjtBQUNBLE1BQUlHLFdBQVcsRUFBZjs7QUFFQUEsV0FBU0MsR0FBVCxHQUFlSCxPQUFPSSxNQUFQLEVBQWY7QUFDQUosU0FBT0ssUUFBUDtBQUNBSCxXQUFTSSxPQUFULEdBQW1CTixPQUFPTyxVQUFQLEVBQW5COztBQUVBLE1BQUksQ0FBQyxLQUFELEVBQVEsY0FBUixFQUF3QkMsT0FBeEIsQ0FBZ0MsQ0FBQ04sU0FBU0ksT0FBVCxJQUFvQixFQUFyQixFQUF5QkcsV0FBekIsRUFBaEMsS0FBMkUsQ0FBL0UsRUFBa0Y7QUFDaEZULFdBQU9LLFFBQVA7QUFDQUgsYUFBU0ksT0FBVCxJQUFvQixNQUFNTixPQUFPVSxVQUFQLENBQWtCLDRCQUFsQixDQUExQjtBQUNEOztBQUVELE1BQUksQ0FB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QUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEIsRUFBMEQ7QUFDeEQsb0JBQU0sSUFBSXhCLEtBQUosQ0FBVSxvQ0FBb0MsS0FBS04sR0FBTCxHQUFXZCxDQUEvQyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQTtBQTNYSjtBQTZYRDtBQUNGIiwiZmlsZSI6InBhcnNlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIFNQLCBESUdJVCwgQVRPTV9DSEFSLFxuICBUQUcsIENPTU1BTkQsIHZlcmlmeVxufSBmcm9tICcuL2Zvcm1hbC1zeW50YXgnXG5cbmxldCBBU0NJSV9OTCA9IDEwXG5sZXQgQVNDSUlfQ1IgPSAxM1xubGV0IEFTQ0lJX1NQQUNFID0gMzJcbmxldCBBU0NJSV9MRUZUX0JSQUNLRVQgPSA5MVxubGV0IEFTQ0lJX1JJR0hUX0JSQUNLRVQgPSA5M1xuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGUgKHVpbnQ4QXJyYXkpIHtcbiAgY29uc3QgYmF0Y2hTaXplID0gMTAyNDBcbiAgdmFyIHN0cmluZ3MgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdWludDhBcnJheS5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgY29uc3QgYmVnaW4gPSBpXG4gICAgY29uc3QgZW5kID0gTWF0aC5taW4oaSArIGJhdGNoU2l6ZSwgdWludDhBcnJheS5sZW5ndGgpXG4gICAgc3RyaW5ncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgdWludDhBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKSkpXG4gIH1cblxuICByZXR1cm4gc3RyaW5ncy5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGVUcmltbWVkICh1aW50OEFycmF5KSB7XG4gIGxldCBiZWdpbiA9IDBcbiAgbGV0IGVuZCA9IHVpbnQ4QXJyYXkubGVuZ3RoXG5cbiAgd2hpbGUgKHVpbnQ4QXJyYXlbYmVnaW5dID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGJlZ2luKytcbiAgfVxuXG4gIHdoaWxlICh1aW50OEFycmF5W2VuZCAtIDFdID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGVuZC0tXG4gIH1cblxuICBpZiAoYmVnaW4gIT09IDAgfHwgZW5kICE9PSB1aW50OEFycmF5Lmxlbmd0aCkge1xuICAgIHVpbnQ4QXJyYXkgPSB1aW50OEFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpXG4gIH1cblxuICByZXR1cm4gZnJvbUNoYXJDb2RlKHVpbnQ4QXJyYXkpXG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkgKHVpbnQ4QXJyYXkpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB1aW50OEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHVpbnQ4QXJyYXlbaV0gIT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZVxufVxuXG5jbGFzcyBQYXJzZXJJbnN0YW5jZSB7XG4gIGNvbnN0cnVjdG9yIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoaW5wdXQgfHwgMClcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdGhpcy5wb3MgPSAwXG4gIH1cbiAgZ2V0VGFnICgpIHtcbiAgICBpZiAoIXRoaXMudGFnKSB7XG4gICAgICB0aGlzLnRhZyA9IHRoaXMuZ2V0RWxlbWVudChUQUcoKSArICcqKycsIHRydWUpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRhZ1xuICB9XG5cbiAgZ2V0Q29tbWFuZCAoKSB7XG4gICAgaWYgKCF0aGlzLmNvbW1hbmQpIHtcbiAgICAgIHRoaXMuY29tbWFuZCA9IHRoaXMuZ2V0RWxlbWVudChDT01NQU5EKCkpXG4gICAgfVxuXG4gICAgc3dpdGNoICgodGhpcy5jb21tYW5kIHx8ICcnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ09LJzpcbiAgICAgIGNhc2UgJ05PJzpcbiAgICAgIGNhc2UgJ0JBRCc6XG4gICAgICBjYXNlICdQUkVBVVRIJzpcbiAgICAgIGNhc2UgJ0JZRSc6XG4gICAgICAgIGxldCBsYXN0UmlnaHRCcmFja2V0ID0gdGhpcy5yZW1haW5kZXIubGFzdEluZGV4T2YoQVNDSUlfUklHSFRfQlJBQ0tFVClcbiAgICAgICAgaWYgKHRoaXMucmVtYWluZGVyWzFdID09PSBBU0NJSV9MRUZUX0JSQUNLRVQgJiYgbGFzdFJpZ2h0QnJhY2tldCA+IDEpIHtcbiAgICAgICAgICB0aGlzLmh1bWFuUmVhZGFibGUgPSBmcm9tQ2hhckNvZGVUcmltbWVkKHRoaXMucmVtYWluZGVyLnN1YmFycmF5KGxhc3RSaWdodEJyYWNrZXQgKyAxKSlcbiAgICAgICAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDAsIGxhc3RSaWdodEJyYWNrZXQgKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaHVtYW5SZWFkYWJsZSA9IGZyb21DaGFyQ29kZVRyaW1tZWQodGhpcy5yZW1haW5kZXIpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSBuZXcgVWludDhBcnJheSgwKVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY29tbWFuZFxuICB9XG5cbiAgZ2V0RWxlbWVudCAoc3ludGF4KSB7XG4gICAgbGV0IGVsZW1lbnRcbiAgICBpZiAodGhpcy5yZW1haW5kZXJbMF0gPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgbGV0IGZpcnN0U3BhY2UgPSB0aGlzLnJlbWFpbmRlci5pbmRleE9mKEFTQ0lJX1NQQUNFKVxuICAgIGlmICh0aGlzLnJlbWFpbmRlci5sZW5ndGggPiAwICYmIGZpcnN0U3BhY2UgIT09IDApIHtcbiAgICAgIGlmIChmaXJzdFNwYWNlID09PSAtMSkge1xuICAgICAgICBlbGVtZW50ID0gZnJvbUNoYXJDb2RlKHRoaXMucmVtYWluZGVyKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWxlbWVudCA9IGZyb21DaGFyQ29kZSh0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgwLCBmaXJzdFNwYWNlKSlcbiAgICAgIH1cblxuICAgICAgY29uc3QgZXJyUG9zID0gdmVyaWZ5KGVsZW1lbnQsIHN5bnRheClcbiAgICAgIGlmIChlcnJQb3MgPj0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgZXJyUG9zKSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgdGhpcy5wb3MgKz0gZWxlbWVudC5sZW5ndGhcbiAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KGVsZW1lbnQubGVuZ3RoKVxuXG4gICAgcmV0dXJuIGVsZW1lbnRcbiAgfVxuXG4gIGdldFNwYWNlICgpIHtcbiAgICBpZiAoIXRoaXMucmVtYWluZGVyLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgaWYgKHZlcmlmeShTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucmVtYWluZGVyWzBdKSwgU1AoKSkgPj0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIHRoaXMucG9zKytcbiAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDEpXG4gIH1cblxuICBnZXRBdHRyaWJ1dGVzICgpIHtcbiAgICBpZiAoIXRoaXMucmVtYWluZGVyLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMucmVtYWluZGVyWzBdID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIHJldHVybiBuZXcgVG9rZW5QYXJzZXIodGhpcywgdGhpcy5wb3MsIHRoaXMucmVtYWluZGVyLnN1YmFycmF5KCksIHRoaXMub3B0aW9ucykuZ2V0QXR0cmlidXRlcygpXG4gIH1cbn1cblxuY2xhc3MgTm9kZSB7XG4gIGNvbnN0cnVjdG9yICh1aW50OEFycmF5LCBwYXJlbnROb2RlLCBzdGFydFBvcykge1xuICAgIHRoaXMudWludDhBcnJheSA9IHVpbnQ4QXJyYXlcbiAgICB0aGlzLmNoaWxkTm9kZXMgPSBbXVxuICAgIHRoaXMudHlwZSA9IGZhbHNlXG4gICAgdGhpcy5jbG9zZWQgPSB0cnVlXG4gICAgdGhpcy52YWx1ZVNraXAgPSBbXVxuICAgIHRoaXMuc3RhcnRQb3MgPSBzdGFydFBvc1xuICAgIHRoaXMudmFsdWVTdGFydCA9IHRoaXMudmFsdWVFbmQgPSB0eXBlb2Ygc3RhcnRQb3MgPT09ICdudW1iZXInID8gc3RhcnRQb3MgKyAxIDogMFxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHBhcmVudE5vZGVcbiAgICAgIHBhcmVudE5vZGUuY2hpbGROb2Rlcy5wdXNoKHRoaXMpXG4gICAgfVxuICB9XG5cbiAgZ2V0VmFsdWUgKCkge1xuICAgIGxldCB2YWx1ZSA9IGZyb21DaGFyQ29kZSh0aGlzLmdldFZhbHVlQXJyYXkoKSlcbiAgICByZXR1cm4gdGhpcy52YWx1ZVRvVXBwZXJDYXNlID8gdmFsdWUudG9VcHBlckNhc2UoKSA6IHZhbHVlXG4gIH1cblxuICBnZXRWYWx1ZUxlbmd0aCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVFbmQgLSB0aGlzLnZhbHVlU3RhcnQgLSB0aGlzLnZhbHVlU2tpcC5sZW5ndGhcbiAgfVxuXG4gIGdldFZhbHVlQXJyYXkgKCkge1xuICAgIGNvbnN0IHZhbHVlQXJyYXkgPSB0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkodGhpcy52YWx1ZVN0YXJ0LCB0aGlzLnZhbHVlRW5kKVxuXG4gICAgaWYgKHRoaXMudmFsdWVTa2lwLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHZhbHVlQXJyYXlcbiAgICB9XG5cbiAgICBsZXQgZmlsdGVyZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KHZhbHVlQXJyYXkubGVuZ3RoIC0gdGhpcy52YWx1ZVNraXAubGVuZ3RoKVxuICAgIGxldCBiZWdpbiA9IDBcbiAgICBsZXQgb2Zmc2V0ID0gMFxuICAgIGxldCBza2lwID0gdGhpcy52YWx1ZVNraXAuc2xpY2UoKVxuXG4gICAgc2tpcC5wdXNoKHZhbHVlQXJyYXkubGVuZ3RoKVxuXG4gICAgc2tpcC5mb3JFYWNoKGZ1bmN0aW9uIChlbmQpIHtcbiAgICAgIGlmIChlbmQgPiBiZWdpbikge1xuICAgICAgICB2YXIgc3ViQXJyYXkgPSB2YWx1ZUFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpXG4gICAgICAgIGZpbHRlcmVkQXJyYXkuc2V0KHN1YkFycmF5LCBvZmZzZXQpXG4gICAgICAgIG9mZnNldCArPSBzdWJBcnJheS5sZW5ndGhcbiAgICAgIH1cbiAgICAgIGJlZ2luID0gZW5kICsgMVxuICAgIH0pXG5cbiAgICByZXR1cm4gZmlsdGVyZWRBcnJheVxuICB9XG5cbiAgZXF1YWxzICh2YWx1ZSwgY2FzZVNlbnNpdGl2ZSkge1xuICAgIGlmICh0aGlzLmdldFZhbHVlTGVuZ3RoKCkgIT09IHZhbHVlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZXF1YWxzQXQodmFsdWUsIDAsIGNhc2VTZW5zaXRpdmUpXG4gIH1cblxuICBlcXVhbHNBdCAodmFsdWUsIGluZGV4LCBjYXNlU2Vuc2l0aXZlKSB7XG4gICAgY2FzZVNlbnNpdGl2ZSA9IHR5cGVvZiBjYXNlU2Vuc2l0aXZlID09PSAnYm9vbGVhbicgPyBjYXNlU2Vuc2l0aXZlIDogdHJ1ZVxuXG4gICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlRW5kICsgaW5kZXhcblxuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YodGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXgpID49IDApIHtcbiAgICAgICAgaW5kZXgtLVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbmRleCA9IHRoaXMudmFsdWVTdGFydCArIGluZGV4XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YoaW5kZXggLSB0aGlzLnZhbHVlU3RhcnQpID49IDApIHtcbiAgICAgICAgaW5kZXgrK1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5kZXggPj0gdGhpcy52YWx1ZUVuZCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgbGV0IHVpbnQ4Q2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2luZGV4XSlcbiAgICAgIGxldCBjaGFyID0gdmFsdWVbaV1cblxuICAgICAgaWYgKCFjYXNlU2Vuc2l0aXZlKSB7XG4gICAgICAgIHVpbnQ4Q2hhciA9IHVpbnQ4Q2hhci50b1VwcGVyQ2FzZSgpXG4gICAgICAgIGNoYXIgPSBjaGFyLnRvVXBwZXJDYXNlKClcbiAgICAgIH1cblxuICAgICAgaWYgKHVpbnQ4Q2hhciAhPT0gY2hhcikge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgaW5kZXgrK1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc051bWJlciAoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnZhbHVlRW5kIC0gdGhpcy52YWx1ZVN0YXJ0OyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGkpID49IDApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmlzRGlnaXQoaSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIGlzRGlnaXQgKGluZGV4KSB7XG4gICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlRW5kICsgaW5kZXhcblxuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YodGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXgpID49IDApIHtcbiAgICAgICAgaW5kZXgtLVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbmRleCA9IHRoaXMudmFsdWVTdGFydCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4KytcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgYXNjaWkgPSB0aGlzLnVpbnQ4QXJyYXlbaW5kZXhdXG4gICAgcmV0dXJuIGFzY2lpID49IDQ4ICYmIGFzY2lpIDw9IDU3XG4gIH1cblxuICBjb250YWluc0NoYXIgKGNoYXIpIHtcbiAgICBsZXQgYXNjaWkgPSBjaGFyLmNoYXJDb2RlQXQoMClcblxuICAgIGZvciAobGV0IGkgPSB0aGlzLnZhbHVlU3RhcnQ7IGkgPCB0aGlzLnZhbHVlRW5kOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGkgLSB0aGlzLnZhbHVlU3RhcnQpID49IDApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpXSA9PT0gYXNjaWkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5jbGFzcyBUb2tlblBhcnNlciB7XG4gIGNvbnN0cnVjdG9yIChwYXJlbnQsIHN0YXJ0UG9zLCB1aW50OEFycmF5LCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9uc1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50XG5cbiAgICB0aGlzLnRyZWUgPSB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKClcbiAgICB0aGlzLnBvcyA9IHN0YXJ0UG9zIHx8IDBcblxuICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdUUkVFJ1xuXG4gICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPSB0cnVlXG4gICAgfVxuXG4gICAgdGhpcy5wcm9jZXNzU3RyaW5nKHBhcmVudC5jb21tYW5kKVxuICB9XG5cbiAgZ2V0QXR0cmlidXRlcyAoKSB7XG4gICAgbGV0IGF0dHJpYnV0ZXMgPSBbXVxuICAgIGxldCBicmFuY2ggPSBhdHRyaWJ1dGVzXG5cbiAgICBsZXQgd2FsayA9IG5vZGUgPT4ge1xuICAgICAgbGV0IGVsbVxuICAgICAgbGV0IGN1ckJyYW5jaCA9IGJyYW5jaFxuICAgICAgbGV0IHBhcnRpYWxcblxuICAgICAgaWYgKCFub2RlLmNsb3NlZCAmJiBub2RlLnR5cGUgPT09ICdTRVFVRU5DRScgJiYgbm9kZS5lcXVhbHMoJyonKSkge1xuICAgICAgICBub2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgbm9kZS50eXBlID0gJ0FUT00nXG4gICAgICB9XG5cbiAgICAvLyBJZiB0aGUgbm9kZSB3YXMgbmV2ZXIgY2xvc2VkLCB0aHJvdyBpdFxuICAgICAgaWYgKCFub2RlLmNsb3NlZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyB0aGlzLnVpbnQ4QXJyYXkubGVuZ3RoIC0gMSkpXG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAobm9kZS50eXBlLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSAnTElURVJBTCc6XG4gICAgICAgIGNhc2UgJ1NUUklORyc6XG4gICAgICAgICAgZWxtID0ge1xuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPyBub2RlLmdldFZhbHVlKCkgOiBub2RlLmdldFZhbHVlQXJyYXkoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnQVRPTSc6XG4gICAgICAgICAgaWYgKG5vZGUuZXF1YWxzKCdOSUwnLCB0cnVlKSkge1xuICAgICAgICAgICAgYnJhbmNoLnB1c2gobnVsbClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VDVElPTic6XG4gICAgICAgICAgYnJhbmNoID0gYnJhbmNoW2JyYW5jaC5sZW5ndGggLSAxXS5zZWN0aW9uID0gW11cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdMSVNUJzpcbiAgICAgICAgICBlbG0gPSBbXVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmFuY2ggPSBlbG1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBwYXJ0aWFsID0gbm9kZS5nZXRWYWx1ZSgpLnNwbGl0KCcuJykubWFwKE51bWJlcilcbiAgICAgICAgICBicmFuY2hbYnJhbmNoLmxlbmd0aCAtIDFdLnBhcnRpYWwgPSBwYXJ0aWFsXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cblxuICAgICAgbm9kZS5jaGlsZE5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkTm9kZSkge1xuICAgICAgICB3YWxrKGNoaWxkTm9kZSlcbiAgICAgIH0pXG4gICAgICBicmFuY2ggPSBjdXJCcmFuY2hcbiAgICB9XG5cbiAgICB3YWxrKHRoaXMudHJlZSlcblxuICAgIHJldHVybiBhdHRyaWJ1dGVzXG4gIH1cblxuICBjcmVhdGVOb2RlIChwYXJlbnROb2RlLCBzdGFydFBvcykge1xuICAgIHJldHVybiBuZXcgTm9kZSh0aGlzLnVpbnQ4QXJyYXksIHBhcmVudE5vZGUsIHN0YXJ0UG9zKVxuICB9XG5cbiAgcHJvY2Vzc1N0cmluZyAoY29tbWFuZCkge1xuICAgIGxldCBpXG4gICAgbGV0IGxlblxuICAgIGNvbnN0IGNoZWNrU1AgPSAocG9zKSA9PiB7XG4gICAgLy8ganVtcCB0byB0aGUgbmV4dCBub24gd2hpdGVzcGFjZSBwb3NcbiAgICAgIHdoaWxlICh0aGlzLnVpbnQ4QXJyYXlbaSArIDFdID09PSAnICcpIHtcbiAgICAgICAgaSsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2tpcCBub3JtYWwgcGFyc2VyIGlmIFNFQVJDSCBmb3IgYmV0dGVyIHBhcnNpbmcgcGVyZm9ybWFuY2VcbiAgICBpZiAoY29tbWFuZD09PVwiU0VBUkNIXCIpIHtcbiAgICAgIHZhciBzdHJpbmcgPSBuZXcgVGV4dERlY29kZXIoXCJ1dGYtOFwiKS5kZWNvZGUodGhpcy51aW50OEFycmF5KTtcbiAgICAgIHZhciBwYXJ0cyA9IHN0cmluZy5zcGxpdCgnICcpO1xuICAgICAgdmFyIGFycmF5TGVuZ3RoID0gcGFydHMubGVuZ3RoO1xuICAgICAgdmFyIGlwb3MgPSAwO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGFycmF5TGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpcG9zKTtcbiAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nO1xuICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpcG9zO1xuICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnN0YXJ0UG9zID0gaXBvcztcbiAgICAgICAgaXBvcys9cGFydHNbaV0ubGVuZ3RoO1xuICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IGlwb3M7XG4gICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpcG9zO1xuICAgICAgICBpcG9zKz0xO1xuICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoaSA9IDAsIGxlbiA9IHRoaXMudWludDhBcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2ldKVxuXG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSAnTk9STUFMJzpcblxuICAgICAgICAgIHN3aXRjaCAoY2hyKSB7XG4gICAgICAgICAgLy8gRFFVT1RFIHN0YXJ0cyBhIG5ldyBzdHJpbmdcbiAgICAgICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnc3RyaW5nJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NUUklORydcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgLy8gKCBzdGFydHMgYSBuZXcgbGlzdFxuICAgICAgICAgICAgY2FzZSAnKCc6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0xJU1QnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgIC8vICkgY2xvc2VzIGEgbGlzdFxuICAgICAgICAgICAgY2FzZSAnKSc6XG4gICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnR5cGUgIT09ICdMSVNUJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBsaXN0IHRlcm1pbmF0b3IgKSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgLy8gXSBjbG9zZXMgc2VjdGlvbiBncm91cFxuICAgICAgICAgICAgY2FzZSAnXSc6XG4gICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnR5cGUgIT09ICdTRUNUSU9OJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZWN0aW9uIHRlcm1pbmF0b3IgXSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyA8IHN0YXJ0cyBhIG5ldyBwYXJ0aWFsXG4gICAgICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgICAgICAgaWYgKFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2kgLSAxXSkgIT09ICddJykge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnUEFSVElBTCdcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1BBUlRJQUwnXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyB7IHN0YXJ0cyBhIG5ldyBsaXRlcmFsXG4gICAgICAgICAgICBjYXNlICd7JzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnTElURVJBTCdcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdMSVRFUkFMJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyAoIHN0YXJ0cyBhIG5ldyBzZXF1ZW5jZVxuICAgICAgICAgICAgY2FzZSAnKic6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyBub3JtYWxseSBhIHNwYWNlIHNob3VsZCBuZXZlciBvY2N1clxuICAgICAgICAgICAgY2FzZSAnICc6XG4gICAgICAgICAgICAvLyBqdXN0IGlnbm9yZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgLy8gWyBzdGFydHMgc2VjdGlvblxuICAgICAgICAgICAgY2FzZSAnWyc6XG4gICAgICAgICAgICAvLyBJZiBpdCBpcyB0aGUgKmZpcnN0KiBlbGVtZW50IGFmdGVyIHJlc3BvbnNlIGNvbW1hbmQsIHRoZW4gcHJvY2VzcyBhcyBhIHJlc3BvbnNlIGFyZ3VtZW50IGxpc3RcbiAgICAgICAgICAgICAgaWYgKFsnT0snLCAnTk8nLCAnQkFEJywgJ0JZRScsICdQUkVBVVRIJ10uaW5kZXhPZih0aGlzLnBhcmVudC5jb21tYW5kLnRvVXBwZXJDYXNlKCkpID49IDAgJiYgdGhpcy5jdXJyZW50Tm9kZSA9PT0gdGhpcy50cmVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VDVElPTidcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgICAgLy8gUkZDMjIyMSBkZWZpbmVzIGEgcmVzcG9uc2UgY29kZSBSRUZFUlJBTCB3aG9zZSBwYXlsb2FkIGlzIGFuXG4gICAgICAgICAgICAgIC8vIFJGQzIxOTIvUkZDNTA5MiBpbWFwdXJsIHRoYXQgd2Ugd2lsbCB0cnkgdG8gcGFyc2UgYXMgYW4gQVRPTSBidXRcbiAgICAgICAgICAgICAgLy8gZmFpbCBxdWl0ZSBiYWRseSBhdCBwYXJzaW5nLiAgU2luY2UgdGhlIGltYXB1cmwgaXMgc3VjaCBhIHVuaXF1ZVxuICAgICAgICAgICAgICAvLyAoYW5kIGNyYXp5KSB0ZXJtLCB3ZSBqdXN0IHNwZWNpYWxpemUgdGhhdCBjYXNlIGhlcmUuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkoaSArIDEsIGkgKyAxMCkpLnRvVXBwZXJDYXNlKCkgPT09ICdSRUZFUlJBTCAnKSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBSRUZFUlJBTCBhdG9tXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIHRoaXMucG9zICsgaSArIDEpXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpICsgOFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaSArIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgOVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVRvVXBwZXJDYXNlID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgICAgLy8gZWF0IGFsbCB0aGUgd2F5IHRocm91Z2ggdGhlIF0gdG8gYmUgdGhlICBJTUFQVVJMIHRva2VuLlxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCB0aGlzLnBvcyArIGkgKyAxMClcbiAgICAgICAgICAgICAgICAvLyBqdXN0IGNhbGwgdGhpcyBhbiBBVE9NLCBldmVuIHRob3VnaCBJTUFQVVJMIG1pZ2h0IGJlIG1vcmUgY29ycmVjdFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgLy8ganVtcCBpIHRvIHRoZSAnXSdcbiAgICAgICAgICAgICAgICAgIGkgPSB0aGlzLnVpbnQ4QXJyYXkuaW5kZXhPZihBU0NJSV9SSUdIVF9CUkFDS0VULCBpICsgMTApXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IHRoaXMuY3VycmVudE5vZGUuc3RhcnRQb3MgLSB0aGlzLnBvc1xuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IHRoaXMuY3VycmVudE5vZGUuZW5kUG9zIC0gdGhpcy5wb3MgKyAxXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgICAvLyBjbG9zZSBvdXQgdGhlIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAvLyBBbnkgQVRPTSBzdXBwb3J0ZWQgY2hhciBzdGFydHMgYSBuZXcgQXRvbSBzZXF1ZW5jZSwgb3RoZXJ3aXNlIHRocm93IGFuIGVycm9yXG4gICAgICAgICAgICAvLyBBbGxvdyBcXCBhcyB0aGUgZmlyc3QgY2hhciBmb3IgYXRvbSB0byBzdXBwb3J0IHN5c3RlbSBmbGFnc1xuICAgICAgICAgICAgLy8gQWxsb3cgJSB0byBzdXBwb3J0IExJU1QgJycgJVxuICAgICAgICAgICAgICBpZiAoQVRPTV9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICdcXFxcJyAmJiBjaHIgIT09ICclJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdBVE9NJzpcblxuICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyBhbiBhdG9tXG4gICAgICAgICAgaWYgKGNociA9PT0gJyAnKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy9cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlICYmXG4gICAgICAgICAgKFxuICAgICAgICAgICAgKGNociA9PT0gJyknICYmIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnTElTVCcpIHx8XG4gICAgICAgICAgICAoY2hyID09PSAnXScgJiYgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLnR5cGUgPT09ICdTRUNUSU9OJylcbiAgICAgICAgICApXG4gICAgICAgICkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgLSAxXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKChjaHIgPT09ICcsJyB8fCBjaHIgPT09ICc6JykgJiYgdGhpcy5jdXJyZW50Tm9kZS5pc051bWJlcigpKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgfVxuXG4gICAgICAgIC8vIFsgc3RhcnRzIGEgc2VjdGlvbiBncm91cCBmb3IgdGhpcyBlbGVtZW50XG4gICAgICAgICAgaWYgKGNociA9PT0gJ1snICYmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnQk9EWScsIGZhbHNlKSB8fCB0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnQk9EWS5QRUVLJywgZmFsc2UpKSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLCB0aGlzLnBvcyArIGkpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VDVElPTidcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnPCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzdGFydCBvZiBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIGNoYXIgaXMgbm90IEFUT00gY29tcGF0aWJsZSwgdGhyb3cuIEFsbG93IFxcKiBhcyBhbiBleGNlcHRpb25cbiAgICAgICAgICBpZiAoQVRPTV9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICddJyAmJiAhKGNociA9PT0gJyonICYmIHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdcXFxcJykpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnXFxcXConKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU1RSSU5HJzpcblxuICAgICAgICAvLyBEUVVPVEUgZW5kcyB0aGUgc3RyaW5nIHNlcXVlbmNlXG4gICAgICAgICAgaWYgKGNociA9PT0gJ1wiJykge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy8gXFwgRXNjYXBlcyB0aGUgZm9sbG93aW5nIGNoYXJcbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxcXCcpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTa2lwLnB1c2goaSAtIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydClcbiAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgaWYgKGkgPj0gbGVuKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2hyID0gU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXlbaV0pXG4gICAgICAgICAgfVxuXG4gICAgICAgIC8qIC8vIHNraXAgdGhpcyBjaGVjaywgb3RoZXJ3aXNlIHRoZSBwYXJzZXIgbWlnaHQgZXhwbG9kZSBvbiBiaW5hcnkgaW5wdXRcbiAgICAgICAgaWYgKFRFWFRfQ0hBUigpLmluZGV4T2YoY2hyKSA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgKi9cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnUEFSVElBTCc6XG4gICAgICAgICAgaWYgKGNociA9PT0gJz4nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnLicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIHBhcnRpYWwgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNociA9PT0gJy4nICYmICghdGhpcy5jdXJyZW50Tm9kZS5nZXRWYWx1ZUxlbmd0aCgpIHx8IHRoaXMuY3VycmVudE5vZGUuY29udGFpbnNDaGFyKCcuJykpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgcGFydGlhbCBzZXBhcmF0b3IgLiBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKERJR0lUKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICcuJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgIT09ICcuJyAmJiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJzAnKSB8fCB0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuMCcsIC0yKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ0xJVEVSQUwnOlxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnN0YXJ0ZWQpIHtcbiAgICAgICAgICAgIGlmIChjaHIgPT09ICdcXHUwMDAwJykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgXFxcXHgwMCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZ2V0VmFsdWVMZW5ndGgoKSA+PSB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnKycgJiYgdGhpcy5vcHRpb25zLmxpdGVyYWxQbHVzKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxQbHVzID0gdHJ1ZVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnfScpIHtcbiAgICAgICAgICAgIGlmICghKCdsaXRlcmFsTGVuZ3RoJyBpbiB0aGlzLmN1cnJlbnROb2RlKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbGl0ZXJhbCBwcmVmaXggZW5kIGNoYXIgfSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfTkwpIHtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09IEFTQ0lJX0NSICYmIHRoaXMudWludDhBcnJheVtpICsgMl0gPT09IEFTQ0lJX05MKSB7XG4gICAgICAgICAgICAgIGkgKz0gMlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaSArIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCA9IE51bWJlcih0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnN0YXJ0ZWQgPSB0cnVlXG5cbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2Ugd2hlcmUgbGl0ZXJhbCBjb250ZW50IGxlbmd0aCBpcyAwXG4gICAgICAgICAgICAvLyBjbG9zZSB0aGUgbm9kZSByaWdodCBhd2F5LCBkbyBub3Qgd2FpdCBmb3IgYWRkaXRpb25hbCBpbnB1dFxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoRElHSVQoKS5pbmRleE9mKGNocikgPCAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPT09ICcwJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpdGVyYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoIHx8ICcnKSArIGNoclxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyB0aGUgc2VxdWVuY2Ugc2V0XG4gICAgICAgICAgaWYgKGNociA9PT0gJyAnKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUuaXNEaWdpdCgtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJyonLCAtMSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgLSAxXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUgJiZcbiAgICAgICAgICBjaHIgPT09ICddJyAmJlxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICc6Jykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSBzZXBhcmF0b3IgOiBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcqJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcsJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSB3aWxkY2FyZCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcsJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZXF1ZW5jZSBzZXBhcmF0b3IgLCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIS9cXGQvLnRlc3QoY2hyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgvXFxkLy50ZXN0KGNocikgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG51bWJlciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGJ1ZmZlcnMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlckluc3RhbmNlKGJ1ZmZlcnMsIG9wdGlvbnMpXG4gIGxldCByZXNwb25zZSA9IHt9XG5cbiAgcmVzcG9uc2UudGFnID0gcGFyc2VyLmdldFRhZygpXG4gIHBhcnNlci5nZXRTcGFjZSgpXG4gIHJlc3BvbnNlLmNvbW1hbmQgPSBwYXJzZXIuZ2V0Q29tbWFuZCgpXG5cbiAgaWYgKFsnVUlEJywgJ0FVVEhFTlRJQ0FURSddLmluZGV4T2YoKHJlc3BvbnNlLmNvbW1hbmQgfHwgJycpLnRvVXBwZXJDYXNlKCkpID49IDApIHtcbiAgICBwYXJzZXIuZ2V0U3BhY2UoKVxuICAgIHJlc3BvbnNlLmNvbW1hbmQgKz0gJyAnICsgcGFyc2VyLmdldEVsZW1lbnQoQ09NTUFORCgpKVxuICB9XG5cbiAgaWYgKCFpc0VtcHR5KHBhcnNlci5yZW1haW5kZXIpKSB7XG4gICAgcGFyc2VyLmdldFNwYWNlKClcbiAgICByZXNwb25zZS5hdHRyaWJ1dGVzID0gcGFyc2VyLmdldEF0dHJpYnV0ZXMoKVxuICB9XG5cbiAgaWYgKHBhcnNlci5odW1hblJlYWRhYmxlKSB7XG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IChyZXNwb25zZS5hdHRyaWJ1dGVzIHx8IFtdKS5jb25jYXQoe1xuICAgICAgdHlwZTogJ1RFWFQnLFxuICAgICAgdmFsdWU6IHBhcnNlci5odW1hblJlYWRhYmxlXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuIl19
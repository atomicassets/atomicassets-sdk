import { ITypeParser } from './TypeParser';
import BooleanParser from './TypeParser/BooleanParser';
import { ByteParser } from './TypeParser/ByteParser';
import FixedIntegerParser from './TypeParser/FixedIntegerParser';
import FloatingParser from './TypeParser/FloatingParser';
import IPFSParser from './TypeParser/IPFSParser';
import StringParser from './TypeParser/StringParser';
import VariableIntegerParser from './TypeParser/VariableIntegerParser';

// Every parser constructor here only stores its arguments, so each `new` is
// annotated pure. That is what lets a bundler drop this table, and the parser
// classes behind it, out of a consumer that only builds actions: the package
// ships as one flattened ESM module, where an unannotated `new` in a top-level
// initializer anchors its whole class into every bundle regardless of use.
// tslint:disable:object-literal-sort-keys
export const ParserTypes: { [id: string]: ITypeParser } = {
    int8: /* @__PURE__ */ new VariableIntegerParser(1, false),
    int16: /* @__PURE__ */ new VariableIntegerParser(2, false),
    int32: /* @__PURE__ */ new VariableIntegerParser(4, false),
    int64: /* @__PURE__ */ new VariableIntegerParser(8, false),

    uint8: /* @__PURE__ */ new VariableIntegerParser(1, true),
    uint16: /* @__PURE__ */ new VariableIntegerParser(2, true),
    uint32: /* @__PURE__ */ new VariableIntegerParser(4, true),
    uint64: /* @__PURE__ */ new VariableIntegerParser(8, true),

    fixed8: /* @__PURE__ */ new FixedIntegerParser(1),
    fixed16: /* @__PURE__ */ new FixedIntegerParser(2),
    fixed32: /* @__PURE__ */ new FixedIntegerParser(4),
    fixed64: /* @__PURE__ */ new FixedIntegerParser(8),

    bool: /* @__PURE__ */ new BooleanParser(),

    bytes: /* @__PURE__ */ new ByteParser(),
    string: /* @__PURE__ */ new StringParser(),
    image: /* @__PURE__ */ new StringParser(),

    ipfs: /* @__PURE__ */ new IPFSParser(),
    float: /* @__PURE__ */ new FloatingParser(false),
    double: /* @__PURE__ */ new FloatingParser(true)
};

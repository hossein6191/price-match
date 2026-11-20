"""The contract's own pure helpers, answering for the site's tests.

tests/unit/rules.test.mjs and interface.test.mjs run this with `python3 -I` and a JSON list of calls
on stdin, so the TypeScript copies of the contract's rules in lib/rules.ts and the in-memory
contract's rules() are compared with contracts/price_match.py itself, not with a description of it.
A stub stands in for the GenLayer runtime: nothing here touches a network or a model.
"""

import importlib.util
import json
import pathlib
import sys
import types


def _stub():
    stub = types.ModuleType("genlayer")

    class _Any:
        def __getattr__(self, n):
            return _Any()

        def __call__(self, *a, **k):
            return _Any()

        def __getitem__(self, n):
            return _Any()

    class _UserError(Exception):
        pass

    class _VM:
        UserError = _UserError
        Return = object
        Result = object

    class _Public:
        view = staticmethod(lambda f: f)

        class _Write:
            def __call__(self, f):
                return f

            payable = staticmethod(lambda f: f)

        write = _Write()

    class _GL:
        vm = _VM()
        public = _Public()

        class Contract:
            pass

        def __getattr__(self, n):
            return _Any()

    class _T:
        def __init__(self, *a, **k):
            pass

        def __class_getitem__(cls, item):
            return cls

    stub.gl = _GL()
    stub.allow_storage = lambda c: c
    stub.Address = str
    stub.DynArray = _T
    stub.TreeMap = _T
    stub.u256 = int
    stub.u32 = int
    stub.u64 = int
    stub.i64 = int
    stub.__all__ = ["gl", "allow_storage", "Address", "DynArray", "TreeMap", "u256", "u32", "u64", "i64"]
    sys.modules["genlayer"] = stub


def _load():
    _stub()
    path = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "price_match.py"
    spec = importlib.util.spec_from_file_location("price_match", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pm = _load()

ALLOWED = {
    "_text_problem", "_money_problem", "_url_problem", "_prefixes_problem", "_under", "_number_arg", "_atto",
    "_combine_product", "_combine_price", "_combine_stock", "_outcome", "_buyer_value", "_read_word", "_read_price",
    "_whole", "_clean_value",
}


def answer(call):
    fn = call["fn"]
    args = call.get("args", [])
    if fn == "rules":
        return json.loads(pm.PriceMatch.rules(None))
    if fn == "const":
        return getattr(pm, args[0])
    if fn not in ALLOWED:
        raise ValueError("not an allowed helper: " + fn)
    out = getattr(pm, fn)(*args)
    if isinstance(out, int) and not isinstance(out, bool):
        return str(out)  # an integer of atto does not survive a JavaScript number
    return list(out) if isinstance(out, tuple) else out


def main():
    calls = json.loads(sys.stdin.read())
    results = []
    for call in calls:
        try:
            results.append({"ok": answer(call)})
        except Exception as e:  # a helper that raises is an answer too
            results.append({"error": type(e).__name__ + ": " + str(e)})
    sys.stdout.write(json.dumps(results))


main()

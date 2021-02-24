module.exports = function createRuntime({ html, unsafeHTML, repeat, ...opts }) {
    return function runtime(data, opts) {
        var defaults = {
            // autoEscape: "html"
        };
        var _toString = Object.prototype.toString;
        var _hasOwnProperty = Object.prototype.hasOwnProperty;
        var getKeys =
            Object.keys ||
            function (obj) {
                var keys = [];
                for (var n in obj)
                    if (_hasOwnProperty.call(obj, n)) keys.push(n);
                return keys;
            };
        var isArray =
            Array.isArray ||
            function (obj) {
                return _toString.call(obj) === "[object Array]";
            };
        var create =
            Object.create ||
            function (obj) {
                function F() {}
                F.prototype = obj;
                return new F();
            };
        var toString = function (val) {
            if (val == null) return "";
            return typeof val.toString == "function"
                ? val.toString()
                : _toString.call(val);
        };
        var extend = function (dest, src) {
            var keys = getKeys(src);
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];
                dest[key] = src[key];
            }
            return dest;
        };
        //get a value, lexically, starting in current context; a.b -> get("a","b")
        var get = function () {
            var val,
                n = arguments[0],
                c = stack.length;
            while (c--) {
                val = stack[c][n];
                if (typeof val != "undefined") break;
            }
            for (var i = 1, len = arguments.length; i < len; i++) {
                if (val == null) continue;
                n = arguments[i];
                val = _hasOwnProperty.call(val, n)
                    ? val[n]
                    : typeof val._get == "function"
                    ? (val[n] = val._get(n))
                    : null;
            }
            return val == null ? null : val;
        };
        var set = function (n, val) {
            stack[stack.length - 1][n] = val;
        };
        var push = function (ctx) {
            stack.push(ctx || {});
        };
        var pop = function () {
            stack.pop();
        };
        var write = function (str) {
            output.push(str);
        };
        var filter = function (val) {
            for (var i = 1, len = arguments.length; i < len; i++) {
                var arr = arguments[i],
                    name = arr[0],
                    filter = filters[name];
                if (filter) {
                    arr[0] = val;
                    //now arr looks like [val, arg1, arg2]
                    val = filter.apply(data, arr);
                } else {
                    throw new Error("Invalid filter: " + name);
                }
            }
            if (opts.autoEscape && name != opts.autoEscape && name != "safe") {
                //auto escape if not explicitly safe or already escaped
                val = filters[opts.autoEscape].call(data, val);
            }
            return val;
        };
        var each = function (obj, loopvar, fn1, fn2) {
            if (obj == null) return;
            var arr = isArray(obj) ? obj : getKeys(obj),
                len = arr.length;
            var ctx = {
                loop: { length: len, first: arr[0], last: arr[len - 1] },
            };
            // push(ctx);
            let result;
            if (len == 0 && fn2) result = fn2();
            else
                result = repeat(arr, (item, i) => {
                    // extend(ctx.loop, { index: i + 1, index0: i });
                    return fn1(
                        runtime(
                            {
                                [loopvar]: item,
                                index: i + 1,
                                index0: i,
                                ...ctx,
                            },
                            { ...opts, stack }
                        )
                    );
                });
            // revisit this
            // Promise.resolve(true).then(pop);
            return result;
        };
        var block = function (fn) {
            push();
            fn();
            pop();
        };
        var render = function () {
            return output.join("");
        };
        data = data || {};
        opts = extend(defaults, opts || {});
        var filters = extend(
            {
                html:
                    unsafeHTML ||
                    function (val) {
                        return toString(val)
                            .split("&")
                            .join("&amp;")
                            .split("<")
                            .join("&lt;")
                            .split(">")
                            .join("&gt;")
                            .split('"')
                            .join("&quot;");
                    },
                safe:
                    unsafeHTML ||
                    function (val) {
                        return unsafeHTML(val);
                    },
            },
            opts.filters || {}
        );
        var stack = [create(data || {}), ...((opts && opts.stack) || [])],
            output = [];
        return {
            get: get,
            set: set,
            push: push,
            pop: pop,
            write: write,
            filter: filter,
            each: each,
            block: block,
            render: render,
            html: html,
        };
    };
};

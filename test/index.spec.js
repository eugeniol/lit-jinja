const { html, render } = require("lit-html");
const { unsafeHTML } = require("lit-html/directives/unsafe-html");
const { repeat } = require("lit-html/directives/repeat");
const createRuntime = require("../runtime");

import { compile } from "../";

const runtime = createRuntime({ html, unsafeHTML, repeat });

var filters = {
    add: function (val, i) {
        return val + i;
    },
    split: function (str, sep) {
        return String(str).split(sep + "");
    },
    join: function (arr, sep) {
        return Array.isArray(arr) ? arr.join(sep + "") : "";
    },
};
var fileCache = global.fileCache || (global.fileCache = {});
const litJinja = {
    compile(source, opts) {
        const tmpl = compile.call(this, source, { ...opts });
        var name = opts && opts.filename;
        if (name) {
            var file = ~name.indexOf(".") ? name : name + ".html";
            file = "./views/" + file;
            fileCache[file] = source;
        }
        return (context, opts) => {
            const d = document.createElement("div");
            const content = tmpl(runtime(context, opts));
            render(content, d);
            return d.innerHTML.replace(/<!---->/g, "");
        };
    },

    readTemplateFile(name) {
        var file = ~name.indexOf(".") ? name : name + ".html";
        file = "./views/" + file;
        if (file in fileCache) {
            return fileCache[file];
        }
        //todo: read files at module load time
        return (fileCache[file] = fs.readFileSync(file, "utf8"));
    },
};
test("tests string literals", function () {
    const input = `hola {{name}}`;
    const tmpl = litJinja.compile(input);
    expect(tmpl({ name: "mundo" })).toEqual("hola mundo");
});

test("should lit-html object bindings", () => {
    const source = `<uke-el .content="{{someContent}}"></uke-el>`;
    const someContent = { data: true };
    const tmpl = compile(source)(runtime({ someContent }));
    render(tmpl, document.body);

    expect(document.querySelector("uke-el").content).toEqual(someContent);
});

describe("Values and Literals:", function () {
    it("tests string literals", function () {
        var tpl = litJinja.compile('{{ "abc" }}');
        expect(tpl({})).toEqual("abc");

        tpl = litJinja.compile("{{ 'abc' }}");
        expect(tpl({})).toEqual("abc");

        tpl = litJinja.compile("{{ '}}' }}");
        expect(tpl({})).toEqual("}}");
    });

    it("tests other literals", function () {
        var tpl = litJinja.compile("{{ 0 }}");
        expect(tpl({})).toEqual("0");

        tpl = litJinja.compile("{{ true }}");
        expect(tpl({})).toEqual("true");

        tpl = litJinja.compile("{{ false }}");
        expect(tpl({})).toEqual("false");

        tpl = litJinja.compile("{{ null }}");
        expect(tpl({})).toEqual("");
    });
});

describe("Variables and Subscript Access:", function () {
    it("tests string literals", function () {
        var tpl = litJinja.compile("{{ foo.bar }}");
        expect(tpl({ foo: { bar: "baz" } })).toEqual("baz");

        tpl = litJinja.compile('{{ foo["bar"] }}');
        expect(tpl({ foo: { bar: 0 } })).toEqual("0");

        tpl = litJinja.compile("{{ foo[''] }}");
        expect(tpl({ foo: { "": false } })).toEqual("false");

        tpl = litJinja.compile("{{ a[b].c }}");
        expect(tpl({ a: { x: { c: 1 } }, b: "x" })).toEqual("1");

        tpl = litJinja.compile("{{ foo[1] }}");
        expect(tpl({ foo: { 1: 2 } })).toEqual("2");

        tpl = litJinja.compile("{{ foo[0] }}");
        expect(tpl({ foo: [3, 4] })).toEqual("3");
    });
});

describe("Unescaped Output:", function () {
    it("tests string literals", function () {
        var tpl = litJinja.compile("{{{ text }}}");
        expect(tpl({ text: "plain" })).toEqual("plain");

        tpl = litJinja.compile("{{{ html }}}");
        expect(tpl({ html: "<br>" })).toEqual("<br>");

        // tpl = jinja.compile('{{{ "a>c" }}}');
        // expect(tpl({})).toEqual("a>c");
    });
});

describe("Tag: set/assign:", function () {
    it("sets any value as a variable in the current context", function () {
        expect(
            litJinja.compile("{% assign count = 0 %}{{ count }}")({})
        ).toEqual("0");
        expect(litJinja.compile('{% set foo = "bar" %} {{ foo }}')({})).toEqual(
            " bar"
        );
        expect(
            litJinja.compile('{% set foo = ["hi", "bye"] %} {{ foo[0] }}')({})
        ).toEqual(" hi");
        expect(
            litJinja.compile('{% set foo = { bar: "bar" } %} {{ foo.bar }}')({})
        ).toEqual(" bar");
        expect(litJinja.compile("{% set foo = 99 %} {{ foo }}")({})).toEqual(
            " 99"
        );
        expect(
            litJinja.compile(
                "{% set foo = true %}{% if foo == true %}hi{% endif %}"
            )({})
        ).toEqual("hi");
    });

    it("sets for current context", function () {
        expect(
            litJinja.compile(
                "{% set foo = true %}{% if foo %}{% set foo = false %}{% endif %}{{ foo }}"
            )()
        ).toEqual("false");
    });

    it("sets across blocks", function () {
        expect(
            litJinja.compile(
                '{% set foo = "foo" %}{% block a %}{{ foo }}{% set foo = "bar" %}{% endblock %}{{ foo }}{% block b %}{{ foo }}{% endblock %}'
            )()
        ).toEqual("foobarbar");
    });

    //it('sets across extends', function() {
    //  jinja.compile('{% block a %}{{ foo }}{% endblock %}', { filename: 'a' });
    //  expect(jinja.compile('{% extends "a" %}{% set foo = "bar" %}')()
    //  ).toEqual('bar');
    //});
});

describe("Filter:", function () {
    var opts = { filters: filters };

    function testFilter(filter, input, output, message) {
        it(message, function () {
            var tpl = litJinja.compile("{{ v|" + filter + " }}");
            expect(tpl(input, opts)).toEqual(output);
        });
    }

    describe("numbers and strings:", function () {
        var tpl = litJinja.compile("{{ 0|add(1) }}");
        expect(tpl({}, opts)).toEqual("1");

        tpl = litJinja.compile("{{ '0'|add(1) }}");
        expect(tpl({}, opts)).toEqual("01");

        testFilter("add(2)", { v: 1 }, "3", "add numbers");
        testFilter(
            "add(2)",
            { v: "1" },
            "12",
            "string number is not real number"
        );
        testFilter(
            "add(2)",
            { v: "foo" },
            "foo2",
            "string var turns addend into a string"
        );
        testFilter(
            'add("bar")',
            { v: "foo" },
            "foobar",
            "strings concatenated"
        );
        testFilter(
            'split("|")|join(":")',
            { v: "a|b|c" },
            "a:b:c",
            "string split join with pipe and colon"
        );
        testFilter(
            'split:":" | join:")"',
            { v: "a:b:c" },
            "a)b)c",
            "test alternate (liquid-style) filter args"
        );

        tpl = litJinja.compile("{{ 0 || [1, 'a', false] | join('|') }}");
        expect(tpl({}, opts)).toEqual("1|a|false");
    });

    it("set number is really a number", function () {
        var opts = { filters: filters };
        expect(
            litJinja.compile("{% set foo = 1 %}{{ foo|add(1) }}")({}, opts)
        ).toEqual("2");
        expect(
            litJinja.compile('{% set foo = "1" %}{{ foo|add(1) }}')({}, opts)
        ).toEqual("11");
        expect(
            litJinja.compile(
                "{% set bar = 1 %} {% set foo = bar %}{{ foo|add(1) }}"
            )({}, opts)
        ).toEqual(" 2");
    });

    describe("html:", function () {
        testFilter("html", { v: "<&>" }, "&lt;&amp;&gt;", "Unescaped output");
    });

    describe.skip("safe:", function () {
        testFilter("safe", { v: "<&>" }, "<&>", "Unescaped output");
    });

    describe("alternate syntax:", function () {
        var tpl = litJinja.compile("{{ 0 | add: 1 }}");
        expect(tpl({}, opts)).toEqual("1");

        tpl = litJinja.compile('{{ "a" | add: "b" }}');
        expect(tpl({}, opts)).toEqual("ab");
    });
});

describe.skip("Whitespace Control:", function () {
    it("leading and trailing whitespace", function () {
        var tpl = litJinja.compile(' {{- "abc" }} ');
        expect(tpl({})).toEqual("abc ");

        tpl = litJinja.compile(" {{ 'abc' -}} ");
        expect(tpl({})).toEqual(" abc");

        tpl = litJinja.compile(' {{{- "a>c" }}} ');
        expect(tpl({})).toEqual("a>c ");

        tpl = litJinja.compile(" {{{ 'a&c' -}}} ");
        expect(tpl({})).toEqual(" a&c");
    });
});

describe("Tag: if:", function () {
    it("tests truthy and falsy values", function () {
        var tpl = litJinja.compile(
            "{% if foo %}hi!{% endif %}{% if bar %}nope{% endif %}"
        );
        expect(tpl({ foo: 1, bar: false })).toEqual("hi!");

        tpl = litJinja.compile(
            "{% if !foo %}hi!{% endif %}{% if !bar %}nope{% endif %}"
        );
        expect(tpl({ foo: 1, bar: false })).toEqual("nope");
    });

    it("can use not in place of !", function () {
        var tpl = litJinja.compile(
            "{% if not foo %}hi!{% endif %}{% if not bar %}nope{% endif %}"
        );
        expect(tpl({ foo: true, bar: false })).toEqual("nope", "not operator");
    });

    it("can use && and ||", function () {
        var tpl = litJinja.compile(
            "{% if foo && (bar || baz) %}hi!{% endif %}"
        );
        expect(tpl({ foo: true, bar: true })).toEqual("hi!");
        expect(tpl({ foo: true, baz: true })).toEqual("hi!");
        expect(tpl({ foo: false })).toEqual("");
        expect(tpl({ foo: true, bar: false, baz: false })).toEqual("");
    });

    it('can use "and" and "or" instead', function () {
        var tpl = litJinja.compile("{% if foo and bar %}hi!{% endif %}");
        expect(tpl({ foo: true, bar: true })).toEqual("hi!");

        tpl = litJinja.compile("{% if foo or bar %}hi!{% endif %}");
        expect(tpl({ foo: false, bar: true })).toEqual("hi!");
    });

    it('can use the "%" operator', function () {
        var tpl = litJinja.compile("{% if foo % 2 == 0 %}hi!{% endif %}");
        expect(tpl({ foo: 4 })).toEqual("hi!");

        tpl = litJinja.compile("{% if foo % 2 == 0 %}hi!{% endif %}");
        expect(tpl({ foo: 5 })).toEqual("");

        tpl = litJinja.compile("{% if foo % 2 %}hi!{% endif %}");
        expect(tpl({ foo: 4 })).toEqual("");

        tpl = litJinja.compile("{% if foo % 2 %}hi!{% endif %}");
        expect(tpl({ foo: 3 })).toEqual("hi!");
    });

    it("throws on bad conditional syntax", function () {
        var fn1 = function () {
                litJinja.compile("{% if foo bar %}{% endif %}");
            },
            fn2 = function () {
                litJinja.compile("{% if foo !== > bar %}{% endif %}");
            },
            fn3 = function () {
                litJinja.compile("{% if (foo %}{% endif %}");
            },
            fn4 = function () {
                litJinja.compile("{% if foo > bar) %}{% endif %}");
            };
        expect(fn1).toThrow();
        expect(fn2).toThrow();
        expect(fn3).toThrow();
        expect(fn4).toThrow();
    });

    it("can accept some arbitrary parentheses", function () {
        var tpl = litJinja.compile("{% if (foo) %}bar{% endif %}");
        expect(tpl({ foo: true })).toEqual("bar");

        tpl = litJinja.compile("{% if ( foo ) %}bar{% endif %}");
        expect(tpl({ foo: true })).toEqual("bar");

        tpl = litJinja.compile("{% if ( foo && (bar)) %}bar{% endif %}");
        expect(tpl({ foo: true, bar: true })).toEqual("bar");

        tpl = litJinja.compile("{% if (( foo && (bar )) ) %}bar{% endif %}");
        expect(tpl({ foo: true, bar: true })).toEqual("bar");
    });
});

describe("Tag: else:", function () {
    it("gets used", function () {
        var tpl = litJinja.compile(
            "{% if foo.length > 1 %}hi!{% else %}nope{% endif %}"
        );
        expect(tpl({ foo: [1, 2, 3] })).toEqual("hi!");
        expect(tpl({ foo: [1] })).toEqual("nope");
    });

    it('throws if used outside of "if" context', function () {
        var fn = function () {
            litJinja.compile("{% else %}");
        };
        expect(fn).toThrow();
    });

    describe("elseif:", function () {
        it("works nicely", function () {
            var tpl = litJinja.compile(
                "{% if foo.length > 2 %}foo{% elseif foo.length < 2 %}bar{% endif %}"
            );
            expect(tpl({ foo: [1, 2, 3] })).toEqual("foo");
            expect(tpl({ foo: [1, 2] })).toEqual("");
            expect(tpl({ foo: [1] })).toEqual("bar");
        });

        it("accepts conditionals", function () {
            var tpl = litJinja.compile(
                "{% if foo %}foo{% elseif bar && baz %}bar{% endif %}"
            );
            expect(tpl({ bar: true, baz: true })).toEqual("bar");
        });
    });

    it("can have multiple elseif and else conditions", function () {
        var tpl = litJinja.compile(
            '{% if foo %}foo{% elseif bar === "bar" %}bar{% elseif baz.length == 2 %}baz{% else %}bop{% endif %}'
        );
        expect(tpl({ foo: true })).toEqual("foo");
        expect(tpl({ bar: "bar" })).toEqual("bar");
        expect(tpl({ baz: [3, 4] })).toEqual("baz");
        expect(tpl({ baz: [2] })).toEqual("bop");
        expect(tpl({ bar: false })).toEqual("bop");
    });

    describe('in "for" tags:', function () {
        it("can be used as fallback", function () {
            var tpl = litJinja.compile(
                "{% for foo in bar %}blah{% else %}hooray!{% endfor %}"
            );
            expect(tpl({ bar: [] })).toEqual("hooray!");
            expect(tpl({ bar: {} })).toEqual("hooray!");

            expect(tpl({ bar: [1] })).toEqual("blah");
            expect(tpl({ bar: { foo: "foo" } })).toEqual("blah");
        });

        it('throws if using "elseif"', function () {
            var fn = function () {
                litJinja.compile(
                    "{% for foo in bar %}hi!{% elseif blah %}nope{% endfor %}"
                );
            };
            expect(fn).toThrow();
        });
    });
});
describe("Tag: for:", function () {
    var tpl = litJinja.compile("{% for foo in bar %}{{ foo }}, {% endfor %}");
    it("loops arrays", function () {
        expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual("foo, bar, baz, ");
    });

    it("loops objects", function () {
        expect(tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })).toEqual(
            "baz, pow, foo, "
        );
    });

    it("loops object literals", function () {
        tpl = litJinja.compile(
            "{% for foo in {baz: 'foo', pow: 'bar'} %}{{ foo }}, {% endfor %}"
        );
        expect(tpl({})).toEqual("baz, pow, ");
    });

    it("loops object literals", function () {
        tpl = litJinja.compile(
            '{%for n in {a: 1, b: "b"} %}{{ foo[n] }}{% endfor %}'
        );
        expect(tpl({ foo: { a: "a", b: 2 } })).toEqual("a2");
    });

    describe("loop object:", function () {
        it("index0", function () {
            var tpl = litJinja.compile(
                "{% for foo in bar %}[{{ loop.index0 }}, {{ foo }}]{% endfor %}"
            );
            expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual(
                "[0, foo][1, bar][2, baz]"
            );
            expect(
                tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })
            ).toEqual("[0, baz][1, pow][2, foo]");
        });

        it("context", function () {
            var inner = litJinja.compile("{{ f }}", { filename: "inner" }),
                tpl = litJinja.compile(
                    '{{ f }}{% for f in bar %}{{ f }}{% include "inner" %}{{ f }}{% endfor %}{{ f }}'
                );
            expect(tpl({ f: "z", bar: ["a"] })).toEqual("zaaaz");
            expect(tpl({ bar: ["a"] })).toEqual("aaa");
        });

        it("index", function () {
            var tpl = litJinja.compile(
                "{% for foo in bar %}{{ loop.index }}{% endfor %}"
            );
            expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual("123");
            expect(
                tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })
            ).toEqual("123");
        });

        it("index0", function () {
            var tpl = litJinja.compile(
                "{% for foo in bar %}{{ loop.index0 }}{% endfor %}"
            );
            expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual("012");
            expect(
                tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })
            ).toEqual("012");
        });
    });
});

describe("Tag: include:", function () {
    it("includes the given template", function () {
        litJinja.compile("{{array.length}}", { filename: "included_2.html" });
        expect(
            litJinja.compile('{% include "included_2.html" %}')({
                array: ["foo"],
            })
        ).toEqual("1");
    });

    it("includes from parent templates", function () {
        litJinja.compile("foobar", { filename: "foobar" });
        litJinja.compile('{% include "foobar" %}', { filename: "parent" });
        expect(litJinja.compile('{% extends "parent" %}')()).toEqual("foobar");
    });
});
describe.skip("Tag: block:", function () {
    it("basic", function () {
        var tpl,
            extends_base = [
                'This is from the "extends_base" template.',
                "",
                "{% block one %}",
                "  This is the default content in block `one`",
                "{% endblock %}",
                "",
                "{% block two %}",
                "  This is the default content in block `two`",
                "{% endblock %}",
            ].join("\n"),
            extends1 = [
                '{% extends "extends_base" %}',
                'This is content from "extends_1", you should not see it',
                "",
                "{% block one %}",
                '  This is the "extends_1" content in block `one`',
                "{% endblock %}",
            ].join("\n");

        litJinja.compile(extends_base, { filename: "extends_base" });
        tpl = litJinja.compile(extends1, { filename: "extends1" });
        expect(tpl({})).toEqual(
            'This is from the "extends_base" template.\n\n\n  This is the "extends_1" content in block `one`\n\n\n\n  This is the default content in block `two`\n'
        );
    });

    it("can chain extends", function () {
        var tpl,
            extends_base = [
                'This is from the "extends_base" template.',
                "",
                "{% block one %}",
                "  This is the default content in block `one`",
                "{% endblock %}",
                "",
                "{% block two %}",
                "  This is the default content in block `two`",
                "{% endblock %}",
            ].join("\n"),
            extends1 = [
                '{% extends "extends_base" %}',
                'This is content from "extends_1", you should not see it',
                "",
                "{% block one %}",
                '  This is the "extends_1" content in block `one`',
                "{% endblock %}",
            ].join("\n"),
            extends2 = [
                '{% extends "extends1" %}',
                'This is content from "extends_2", you should not see it',
                "",
                "{% block one %}",
                '  This is the "extends_2" content in block `one`',
                "{% endblock %}",
            ].join("\n");

        litJinja.compile(extends_base, { filename: "extends_base" });
        litJinja.compile(extends1, { filename: "extends1" });
        tpl = litJinja.compile(extends2, { filename: "extends2" });
        expect(tpl({})).toEqual(
            'This is from the "extends_base" template.\n\n\n  This is the "extends_2" content in block `one`\n\n\n\n  This is the default content in block `two`\n'
        );
    });
});

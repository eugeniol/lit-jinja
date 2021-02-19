const { html, render } = require("lit-html");
var lib = require("../");
const getRuntime = lib.getRuntime;
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
const jinja = {
  compile(source, opts) {
    lib.readTemplateFile = this.getTemplate;
    const tmpl = lib.compile(source, { ...opts, runtime: false });
    var name = opts && opts.filename;
    if (name) {
      var file = ~name.indexOf(".") ? name : name + ".html";
      file = "./views/" + file;
      fileCache[file] = source;
    }
    return (context, opts) => {
      const d = document.createElement("div");
      const content = tmpl(getRuntime(context, opts));
      render(content, d);
      return d.innerHTML.replace(/<!---->/g, "");
    };
  },

  getTemplate(name) {
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
  const tmpl = jinja.compile(input);
  expect(tmpl({ name: "mundo" })).toEqual("hola mundo");
});
describe("Values and Literals:", function () {
  it("tests string literals", function () {
    var tpl = jinja.compile('{{ "abc" }}');
    expect(tpl({})).toEqual("abc");

    tpl = jinja.compile("{{ 'abc' }}");
    expect(tpl({})).toEqual("abc");

    tpl = jinja.compile("{{ '}}' }}");
    expect(tpl({})).toEqual("}}");
  });

  it("tests other literals", function () {
    var tpl = jinja.compile("{{ 0 }}");
    expect(tpl({})).toEqual("0");

    tpl = jinja.compile("{{ true }}");
    expect(tpl({})).toEqual("true");

    tpl = jinja.compile("{{ false }}");
    expect(tpl({})).toEqual("false");

    tpl = jinja.compile("{{ null }}");
    expect(tpl({})).toEqual("");
  });
});

describe("Variables and Subscript Access:", function () {
  it("tests string literals", function () {
    var tpl = jinja.compile("{{ foo.bar }}");
    expect(tpl({ foo: { bar: "baz" } })).toEqual("baz");

    tpl = jinja.compile('{{ foo["bar"] }}');
    expect(tpl({ foo: { bar: 0 } })).toEqual("0");

    tpl = jinja.compile("{{ foo[''] }}");
    expect(tpl({ foo: { "": false } })).toEqual("false");

    tpl = jinja.compile("{{ a[b].c }}");
    expect(tpl({ a: { x: { c: 1 } }, b: "x" })).toEqual("1");

    tpl = jinja.compile("{{ foo[1] }}");
    expect(tpl({ foo: { 1: 2 } })).toEqual("2");

    tpl = jinja.compile("{{ foo[0] }}");
    expect(tpl({ foo: [3, 4] })).toEqual("3");
  });
});

describe("Unescaped Output:", function () {
  it("tests string literals", function () {
    var tpl = jinja.compile("{{{ text }}}");
    expect(tpl({ text: "plain" })).toEqual("plain");

    tpl = jinja.compile("{{{ html }}}");
    expect(tpl({ html: "<br>" })).toEqual("<br>");

    // tpl = jinja.compile('{{{ "a>c" }}}');
    // expect(tpl({})).toEqual("a>c");
  });
});

describe("Tag: set/assign:", function () {
  it("sets any value as a variable in the current context", function () {
    expect(jinja.compile("{% assign count = 0 %}{{ count }}")({})).toEqual("0");
    expect(jinja.compile('{% set foo = "bar" %} {{ foo }}')({})).toEqual(
      " bar"
    );
    expect(
      jinja.compile('{% set foo = ["hi", "bye"] %} {{ foo[0] }}')({})
    ).toEqual(" hi");
    expect(
      jinja.compile('{% set foo = { bar: "bar" } %} {{ foo.bar }}')({})
    ).toEqual(" bar");
    expect(jinja.compile("{% set foo = 99 %} {{ foo }}")({})).toEqual(" 99");
    expect(
      jinja.compile("{% set foo = true %}{% if foo == true %}hi{% endif %}")({})
    ).toEqual("hi");
  });

  it("sets for current context", function () {
    expect(
      jinja.compile(
        "{% set foo = true %}{% if foo %}{% set foo = false %}{% endif %}{{ foo }}"
      )()
    ).toEqual("false");
  });

  it("sets across blocks", function () {
    expect(
      jinja.compile(
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
      var tpl = jinja.compile("{{ v|" + filter + " }}");
      expect(tpl(input, opts)).toEqual(output);
    });
  }

  describe("numbers and strings:", function () {
    var tpl = jinja.compile("{{ 0|add(1) }}");
    expect(tpl({}, opts)).toEqual("1");

    tpl = jinja.compile("{{ '0'|add(1) }}");
    expect(tpl({}, opts)).toEqual("01");

    testFilter("add(2)", { v: 1 }, "3", "add numbers");
    testFilter("add(2)", { v: "1" }, "12", "string number is not real number");
    testFilter(
      "add(2)",
      { v: "foo" },
      "foo2",
      "string var turns addend into a string"
    );
    testFilter('add("bar")', { v: "foo" }, "foobar", "strings concatenated");
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

    tpl = jinja.compile("{{ 0 || [1, 'a', false] | join('|') }}");
    expect(tpl({}, opts)).toEqual("1|a|false");
  });

  it("set number is really a number", function () {
    var opts = { filters: filters };
    expect(
      jinja.compile("{% set foo = 1 %}{{ foo|add(1) }}")({}, opts)
    ).toEqual("2");
    expect(
      jinja.compile('{% set foo = "1" %}{{ foo|add(1) }}')({}, opts)
    ).toEqual("11");
    expect(
      jinja.compile("{% set bar = 1 %} {% set foo = bar %}{{ foo|add(1) }}")(
        {},
        opts
      )
    ).toEqual(" 2");
  });

  describe("html:", function () {
    testFilter("html", { v: "<&>" }, "&lt;&amp;&gt;", "Unescaped output");
  });

  describe.skip("safe:", function () {
    testFilter("safe", { v: "<&>" }, "<&>", "Unescaped output");
  });

  describe("alternate syntax:", function () {
    var tpl = jinja.compile("{{ 0 | add: 1 }}");
    expect(tpl({}, opts)).toEqual("1");

    tpl = jinja.compile('{{ "a" | add: "b" }}');
    expect(tpl({}, opts)).toEqual("ab");
  });
});

describe.skip("Whitespace Control:", function () {
  it("leading and trailing whitespace", function () {
    var tpl = jinja.compile(' {{- "abc" }} ');
    expect(tpl({})).toEqual("abc ");

    tpl = jinja.compile(" {{ 'abc' -}} ");
    expect(tpl({})).toEqual(" abc");

    tpl = jinja.compile(' {{{- "a>c" }}} ');
    expect(tpl({})).toEqual("a>c ");

    tpl = jinja.compile(" {{{ 'a&c' -}}} ");
    expect(tpl({})).toEqual(" a&c");
  });
});

describe("Tag: if:", function () {
  it("tests truthy and falsy values", function () {
    var tpl = jinja.compile(
      "{% if foo %}hi!{% endif %}{% if bar %}nope{% endif %}"
    );
    expect(tpl({ foo: 1, bar: false })).toEqual("hi!");

    tpl = jinja.compile(
      "{% if !foo %}hi!{% endif %}{% if !bar %}nope{% endif %}"
    );
    expect(tpl({ foo: 1, bar: false })).toEqual("nope");
  });

  it("can use not in place of !", function () {
    var tpl = jinja.compile(
      "{% if not foo %}hi!{% endif %}{% if not bar %}nope{% endif %}"
    );
    expect(tpl({ foo: true, bar: false })).toEqual("nope", "not operator");
  });

  it("can use && and ||", function () {
    var tpl = jinja.compile("{% if foo && (bar || baz) %}hi!{% endif %}");
    expect(tpl({ foo: true, bar: true })).toEqual("hi!");
    expect(tpl({ foo: true, baz: true })).toEqual("hi!");
    expect(tpl({ foo: false })).toEqual("");
    expect(tpl({ foo: true, bar: false, baz: false })).toEqual("");
  });

  it('can use "and" and "or" instead', function () {
    var tpl = jinja.compile("{% if foo and bar %}hi!{% endif %}");
    expect(tpl({ foo: true, bar: true })).toEqual("hi!");

    tpl = jinja.compile("{% if foo or bar %}hi!{% endif %}");
    expect(tpl({ foo: false, bar: true })).toEqual("hi!");
  });

  it('can use the "%" operator', function () {
    var tpl = jinja.compile("{% if foo % 2 == 0 %}hi!{% endif %}");
    expect(tpl({ foo: 4 })).toEqual("hi!");

    tpl = jinja.compile("{% if foo % 2 == 0 %}hi!{% endif %}");
    expect(tpl({ foo: 5 })).toEqual("");

    tpl = jinja.compile("{% if foo % 2 %}hi!{% endif %}");
    expect(tpl({ foo: 4 })).toEqual("");

    tpl = jinja.compile("{% if foo % 2 %}hi!{% endif %}");
    expect(tpl({ foo: 3 })).toEqual("hi!");
  });

  it("throws on bad conditional syntax", function () {
    var fn1 = function () {
        jinja.compile("{% if foo bar %}{% endif %}");
      },
      fn2 = function () {
        jinja.compile("{% if foo !== > bar %}{% endif %}");
      },
      fn3 = function () {
        jinja.compile("{% if (foo %}{% endif %}");
      },
      fn4 = function () {
        jinja.compile("{% if foo > bar) %}{% endif %}");
      };
    expect(fn1).toThrow();
    expect(fn2).toThrow();
    expect(fn3).toThrow();
    expect(fn4).toThrow();
  });

  it("can accept some arbitrary parentheses", function () {
    var tpl = jinja.compile("{% if (foo) %}bar{% endif %}");
    expect(tpl({ foo: true })).toEqual("bar");

    tpl = jinja.compile("{% if ( foo ) %}bar{% endif %}");
    expect(tpl({ foo: true })).toEqual("bar");

    tpl = jinja.compile("{% if ( foo && (bar)) %}bar{% endif %}");
    expect(tpl({ foo: true, bar: true })).toEqual("bar");

    tpl = jinja.compile("{% if (( foo && (bar )) ) %}bar{% endif %}");
    expect(tpl({ foo: true, bar: true })).toEqual("bar");
  });
});

describe("Tag: else:", function () {
  it("gets used", function () {
    var tpl = jinja.compile(
      "{% if foo.length > 1 %}hi!{% else %}nope{% endif %}"
    );
    expect(tpl({ foo: [1, 2, 3] })).toEqual("hi!");
    expect(tpl({ foo: [1] })).toEqual("nope");
  });

  it('throws if used outside of "if" context', function () {
    var fn = function () {
      jinja.compile("{% else %}");
    };
    expect(fn).toThrow();
  });

  describe("elseif:", function () {
    it("works nicely", function () {
      var tpl = jinja.compile(
        "{% if foo.length > 2 %}foo{% elseif foo.length < 2 %}bar{% endif %}"
      );
      expect(tpl({ foo: [1, 2, 3] })).toEqual("foo");
      expect(tpl({ foo: [1, 2] })).toEqual("");
      expect(tpl({ foo: [1] })).toEqual("bar");
    });

    it("accepts conditionals", function () {
      var tpl = jinja.compile(
        "{% if foo %}foo{% elseif bar && baz %}bar{% endif %}"
      );
      expect(tpl({ bar: true, baz: true })).toEqual("bar");
    });
  });

  it("can have multiple elseif and else conditions", function () {
    var tpl = jinja.compile(
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
      var tpl = jinja.compile(
        "{% for foo in bar %}blah{% else %}hooray!{% endfor %}"
      );
      expect(tpl({ bar: [] })).toEqual("hooray!");
      expect(tpl({ bar: {} })).toEqual("hooray!");

      expect(tpl({ bar: [1] })).toEqual("blah");
      expect(tpl({ bar: { foo: "foo" } })).toEqual("blah");
    });

    it('throws if using "elseif"', function () {
      var fn = function () {
        jinja.compile(
          "{% for foo in bar %}hi!{% elseif blah %}nope{% endfor %}"
        );
      };
      expect(fn).toThrow();
    });
  });
});
describe("Tag: for:", function () {
  var tpl = jinja.compile("{% for foo in bar %}{{ foo }}, {% endfor %}");
  it("loops arrays", function () {
    expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual("foo, bar, baz, ");
  });

  it("loops objects", function () {
    expect(tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })).toEqual(
      "baz, pow, foo, "
    );
  });

  it("loops object literals", function () {
    tpl = jinja.compile(
      "{% for foo in {baz: 'foo', pow: 'bar'} %}{{ foo }}, {% endfor %}"
    );
    expect(tpl({})).toEqual("baz, pow, ");
  });

  it("loops object literals", function () {
    tpl = jinja.compile('{%for n in {a: 1, b: "b"} %}{{ foo[n] }}{% endfor %}');
    expect(tpl({ foo: { a: "a", b: 2 } })).toEqual("a2");
  });

  describe("loop object:", function () {
    it("index0", function () {
      var tpl = jinja.compile(
        "{% for foo in bar %}[{{ loop.index0 }}, {{ foo }}]{% endfor %}"
      );
      expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual(
        "[0, foo][1, bar][2, baz]"
      );
      expect(tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })).toEqual(
        "[0, baz][1, pow][2, foo]"
      );
    });

    it("context", function () {
      var inner = jinja.compile("{{ f }}", { filename: "inner" }),
        tpl = jinja.compile(
          '{{ f }}{% for f in bar %}{{ f }}{% include "inner" %}{{ f }}{% endfor %}{{ f }}'
        );
      expect(tpl({ f: "z", bar: ["a"] })).toEqual("zaaaz");
      expect(tpl({ bar: ["a"] })).toEqual("aaa");
    });

    it("index", function () {
      var tpl = jinja.compile(
        "{% for foo in bar %}{{ loop.index }}{% endfor %}"
      );
      expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual("123");
      expect(tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })).toEqual(
        "123"
      );
    });

    it("index0", function () {
      var tpl = jinja.compile(
        "{% for foo in bar %}{{ loop.index0 }}{% endfor %}"
      );
      expect(tpl({ bar: ["foo", "bar", "baz"] })).toEqual("012");
      expect(tpl({ bar: { baz: "foo", pow: "bar", foo: "baz" } })).toEqual(
        "012"
      );
    });
  });
});

describe("Tag: include:", function () {
  it("includes the given template", function () {
    jinja.compile("{{array.length}}", { filename: "included_2.html" });
    expect(
      jinja.compile('{% include "included_2.html" %}')({ array: ["foo"] })
    ).toEqual("1");
  });

  it("includes from parent templates", function () {
    jinja.compile("foobar", { filename: "foobar" });
    jinja.compile('{% include "foobar" %}', { filename: "parent" });
    expect(jinja.compile('{% extends "parent" %}')()).toEqual("foobar");
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

    jinja.compile(extends_base, { filename: "extends_base" });
    tpl = jinja.compile(extends1, { filename: "extends1" });
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

    jinja.compile(extends_base, { filename: "extends_base" });
    jinja.compile(extends1, { filename: "extends1" });
    tpl = jinja.compile(extends2, { filename: "extends2" });
    expect(tpl({})).toEqual(
      'This is from the "extends_base" template.\n\n\n  This is the "extends_2" content in block `one`\n\n\n\n  This is the default content in block `two`\n'
    );
  });
});

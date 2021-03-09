const { mainTemplate } = require("@ordergroove/smi-templates");
// const { Parser } = require("acorn");
const { compile } = require("./");
const util = require("util");
// const walk = require("acorn-walk");
// const compiled = mainTemplate;
// const rawInput = compiled.toString();
// // console.log(compiled.toString());
// const { generate } = require("astring");
// const ast = Parser.parse(rawInput, { ecmaVersion: 6 });
// // console.log(JSON.stringify(ast, null, 4));
// // traverse(ast, {
// //     pre: function (node, parent, prop, idx) {
// //         if (node.type === "CallExpression") {
// //             if (node.callee && node.callee.name === "get") {
// //                 console.log(node.arguments.map(({ value }) => value).join("."));
// //             }
// //         }
// //     },
// // });
// walk.simple(ast, {
//     CallExpression(node) {
//         if (node.callee && node.callee.name === "get") {
//             const { start, end } = node;
//             node.name='anotherGet'
//             // console.log(`[${rawInput.substr(start, end - start)}]`, node);
//         }
//     },
// });
// console.log(generate(ast));

const parser = require("@babel/parser");
const { default: traverse } = require("@babel/traverse");
const { default: generate } = require("@babel/generator");
const t = require("@babel/types");
const { PassThrough } = require("stream");

let code = compile(`
{%for item in list %}
  {%if item === 'hello' %}
    {%for another in item%}
      {{another}}
      {%for onemore in another %}
        {{onemore}}
        {{another}}
        {{item}}
        {{global.thing}}
      {%endfor%}
    {{item}}
    {%endfor%}
    {% assign myVariable = somethign %}
    {{item.while}}
  {%else%}
    another
  {%endif%}
  {{secondName}}
{%endfor%}
`).toString();

// code = mainTemplate.toString();
const ast = parser.parse(code);
console.log(code);
const isSetCall = (e) => {
    console.log("here", e);
    return t.isCallExpression(e) && e.callee.name === "set";
};
traverse(ast, {
    FunctionDeclaration(path) {
        if (path.node.id.name == "anonymous") {
            const names = [];
            // path.traverse({
            //     CallExpression(path) {
            //         if (
            //             path.scope.uid === 1 &&
            //             path.node.callee.name === "get"
            //         ) {
            //             names.push(path.node.arguments[0].value);
            //         }
            //     },
            // });

            path.traverse({
                ConditionalExpression(path) {
                    if (path.node.alternate.type === "NullLiteral") {
                        path.replaceWith(
                            t.logicalExpression(
                                "&&",
                                path.node.test,
                                path.node.consequent
                            )
                        );
                    }
                },
                Identifier(path) {
                    const firstPart = path.node.name.split(".")[0];
                    if (
                        !(
                            path.scope.hasBinding(firstPart) ||
                            path.scope.parentHasBinding(firstPart)
                        ) &&
                        !["html", "repeat"].includes(firstPart)
                    ) {
                        names.push(firstPart);
                    }
                },
                CallExpression(path) {
                    const args = path.node.arguments;
                    if (path.node.callee.name === "get") {
                        if (
                            args.every(
                                ({ type }) =>
                                    type === "StringLiteral" ||
                                    type === "NumericLiteral"
                            )
                        ) {
                            let name = args.reduce(
                                (acc, { value, type }, index) =>
                                    acc +
                                    (type === "NumericLiteral"
                                        ? `[${value}]`
                                        : (index ? "." : "") + value),
                                ""
                            );
                            path.replaceWith(t.identifier(name));
                        }
                    } else if (path.node.callee.name === "filter") {
                        if (args.length === 1) {
                            path.replaceWith(args[0]);
                        }
                    } else if (path.node.callee.name === "each") {
                        path.replaceWith(
                            t.callExpression(t.identifier("repeat"), [
                                args[0],

                                t.arrowFunctionExpression(
                                    [
                                        t.identifier(args[1].value),
                                        t.identifier("index"),
                                    ],
                                    args[2].body,
                                    false
                                ),
                            ])
                        );
                    }
                },
            });
            path.replaceWith(
                t.functionDeclaration(
                    t.identifier("template"),
                    [
                        t.objectPattern(
                            Array.from(new Set(names)).map((val) =>
                                t.objectProperty(
                                    t.identifier(val),
                                    t.identifier(val)
                                )
                            )
                        ),
                    ],
                    path.node.body
                )
            );
        }
    },
    ArrowFunctionExpression(path) {
        if (t.isTaggedTemplateExpression(path.node.body)) {
            let templateLiteral = path.node.body.quasi;
            let vars = [];
            path.traverse({
                CallExpression(p) {
                    if (
                        p.scope === path.scope &&
                        p.node.callee.name === "set"
                    ) {
                        vars.push(
                            t.variableDeclarator(
                                t.identifier(p.node.arguments[0].value)
                                // p.node.arguments[1]
                            )
                        );
                        p.replaceWith(
                            t.callExpression(
                                t.arrowFunctionExpression(
                                    [],
                                    t.blockStatement([
                                        t.expressionStatement(
                                            t.assignmentExpression(
                                                "=",
                                                t.identifier(
                                                    p.node.arguments[0].value
                                                ),
                                                p.node.arguments[1]
                                            )
                                        ),
                                    ])
                                ),
                                []
                            )
                        );
                    }
                },
            });
            path.replaceWith(
                t.arrowFunctionExpression(
                    path.node.params,
                    t.blockStatement([
                        t.variableDeclaration("var", vars),
                        t.returnStatement(path.node.body),
                    ])
                )
            );
        }
    },
});
// console.log(code)
// console.log(util.inspect(ast, {depth:12}));
console.log(generate(ast).code);

//the context 'this' inside tagHandlers is the parser instance
const tagHandlers = {
    if(expr) {
        this.push("${ " + this.parseExpr(expr) + " ? html`");
        this.nest.unshift("if");
    },
    else() {
        if (this.nest[0] == "for") {
            this.push("`, () => html`");
        } else {
            this.push("` : html`");
            this.nest.unshift("else");
        }
    },
    elseif(expr) {
        this.push("` : ");
        this.nest.unshift("else");
        this.push("" + this.parseExpr(expr) + " ? html`");
        this.nest.unshift("if");
    },
    endif() {
        if (this.nest[0] === "else") {
            this.nest.shift();
            this.nest.shift();
            this.push("`}");
        } else {
            this.push("` : null }");
        }
    },
    for(str) {
        var i = str.indexOf(" in ");
        var name = str.slice(0, i).trim();
        var expr = str.slice(i + 4).trim();
        this.push(
            "${each(" +
                this.parseExpr(expr) +
                "," +
                JSON.stringify(name) +
                ",({get,set,push,pop,filter,each,block}) => html`"
        );
        this.nest.unshift("for");
    },
    endfor() {
        this.nest.shift();
        this.push("`)}");
    },
    raw() {
        this.rawMode = true;
    },
    endraw() {
        this.rawMode = false;
    },
    set(stmt) {
        var i = stmt.indexOf("=");
        var name = stmt.slice(0, i).trim();
        var expr = stmt.slice(i + 1).trim();
        this.push(
            "${ set(" +
                JSON.stringify(name) +
                "," +
                this.parseExpr(expr) +
                ") }"
        );
    },
    block(name) {
        if (this.isParent) {
            ++this.parentBlocks;
            var blockName =
                "block_" + (this.escName(name) || this.parentBlocks);
            this.push(
                "${ block(typeof " +
                    blockName +
                    ' == "function" ? ' +
                    blockName +
                    " : function() { return html`"
            );
        } else if (this.hasParent) {
            this.isSilent = false;
            ++this.childBlocks;
            blockName = "block_" + (this.escName(name) || this.childBlocks);
            this.push("${ function " + blockName + "() { return html`");
        }
        this.nest.unshift("block");
    },
    endblock() {
        this.nest.shift();
        if (this.isParent) {
            this.push("`})}");
        } else if (this.hasParent) {
            this.push("`; } }");
            this.isSilent = true;
        }
    },
    extends(name) {
        name = this.parseQuoted(name);
        var parentSrc = this.readTemplateFile(name);
        this.isParent = true;
        this.tokenize(parentSrc);
        this.isParent = false;
        this.hasParent = true;
        //silence output until we enter a child block
        this.isSilent = true;
    },
    include(name) {
        name = this.parseQuoted(name);
        var incSrc = this.readTemplateFile(name);
        this.isInclude = true;
        this.tokenize(incSrc);
        this.isInclude = false;
    },
};

//liquid style
tagHandlers.assign = tagHandlers.set;

//python/django style
tagHandlers.elif = tagHandlers.elseif;

module.exports = tagHandlers;

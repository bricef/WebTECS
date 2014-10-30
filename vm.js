#!/usr/bin/env node

var fs = require("fs");
var util = require("util");
var parser = require('./vm_parser');
var program = require('commander');
var waxeye = require('waxeye');
var _ = require('underscore');

program
  .version('0.0.1')
  .option('-i, --input [infile]', 'Input VM language file')
  .option('-o, --output [outfile]', 'Output HACK language file')
  .parse(process.argv);


var PROG_SUFFIX = (new Date()).getTime().toString();

function FATAL (msg, obj) {
	console.error("FATAL EXCEPTION: "+msg+"\n"+obj.toString());
	process.exit(1);
}

function stringify(AST){
	return AST.children.join('');
}

function logAST(AST){
	console.log(AST.type.toUpperCase()+"["+stringify(AST)+"]");
}

var Initialisation = [
	"// StackPointer initialisation",
    "@SP",
    "@256",
    "D=A",
    "@SP",
    "M=D"
];


var EndOfProgram = [
	"// End of program",
	"(ENDPROG."+PROG_SUFFIX+")",
	"@ENDPROG."+PROG_SUFFIX,
	"0;JMP"
];

var POPD = [
	"@SP",
	"A=M",
	"D=M",
	"@SP",
	"M=M-1"
]

var operators = {
	add:[
		"// ADD",
		POPD,
		"@SP",
		"A=M-1",
		"M=D+M"
	],
	sub:[
		"// SUB",
		POPD,
		"@SP",
		"A=M-1",
		"M=D-M"
	]	
	/*
	"neg":,
	"eq":,
	"gt":,
	"lt":,
	"and":,
	"or":,
	"not":,
	*/
};


var segment = {
	argument:["@ARG", "A=M"],
	local:["@LCL", "A=M"],
	static:[],
	contant:function(index){
		if(index > 0xffff){
			FATAL("Cannot access constant  segment > "+0xffff);
		}
		return "@"+index
	},
	this:["@THIS", "A=M"],
	that:["@THAT", "A=M"],
	pointer:["@3"],
	temp:["@5"]

}

var handlers = {
	operator: function(AST){
		var op = stringify(AST);
		if(!(op in operators)){
			FATAL("Operator Not handled: "+op);
		}
		return operators[op];
	},
	function: function(AST){
		var name = stringify(AST.children[0]);
		var nLocals = parseInt(stringify(AST.children[1]));
		return [
			"// Function "+name+" "+nLocals
		];
	},


	// WORK HERE
	push: function(AST){
		var segment = stringify(AST.children[0]);
		var chars = []
		if( 'type' in AST.children[1].children){
			chars = AST.children[1].children[0]
		}else{
			chars = AST.children[1];
		}
		var index =  parseInt(stringify(chars));
		
		return [
			"// Push "+segment+" "+index,
			"//..."
		];
	},
	pop: function(AST){
		var segment = stringify(AST.children[0]);
		var index = parseInt(stringify(AST.children[1]));
		
		return [
			"// Pop "+segment+" "+index
		];
	},
	return: function(AST){
		
		return [
			"// return "
		];
	}
};

function visitor(AST){
	var commands = [];
	AST.children.forEach(function(node){
		if(node.type in handlers){
			commands.push(handlers[node.type](node));
		}else if(node instanceof waxeye.AST){
			commands.push(visitor(node));
		}else{
			// bail out because we don't know what the hell we're dealing with
			FATAL("Could not deal with node: ", node);
		}
	});
	return commands;
}

function parse_file(data){
	var p = new parser.VmParser();
	var result = p.parse(data);

	if (result instanceof waxeye.AST) {
		// We could indent based on nesting in the result...
		return _.flatten([Initialisation, visitor(result), EndOfProgram]).join('\n')+"\n";
	}else {
		if (result instanceof waxeye.ParseError) {
			FATAL("Parse error occured: ", result);
		}
		else {
			FATAL("Null or empty file");
		}
	}
	return ""
}


function main(){
	var input,output;

	if(program.input){
		input = fs.createReadStream(program.input);
	}else{
		input = process.stdin;
	}


	if(program.output){
		output = fs.createWriteStream(program.output);
	}else{
		output = process.stdout;
	}

	input.resume();
	input.setEncoding('utf8');

	var data = '';
	input.on('data', function(buf){
		data += buf;
	});
	input.on('end', function(){
		output.write(parse_file(data));
	});

}

main();

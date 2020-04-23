/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

/// <reference path="./cross-spawn.d.ts" />
import { spawn } from 'cross-spawn';
import * as vscode from 'vscode';
import { configDeterminePath } from './config';
import * as path from 'path';
import * as fs from 'fs';


/*
type KnowledgeMap struct {
	Principals []string
	Constants  []Constant
	Assigned   []Value
	Creator    []string
	KnownBy    [][]map[string]string
	Phase      [][]int
	MaxPhase   int
}

type PrincipalState struct {
	Name          string
	Constants     []Constant
	Assigned      []Value
	Guard         []bool
	Known         []bool
	Wire          [][]string
	KnownBy       [][]map[string]string
	Creator       []string
	Sender        []string
	Rewritten     []bool
	BeforeRewrite []Value
	Mutated       []bool
	MutatableTo   [][]string
	BeforeMutate  []Value
	Phase         [][]int
	Lock          int
}
*/

export default class VerifpalLib {
	static execVerifpal(fileContents, args) {
		return new Promise((resolve, reject) => {
			let verifpalOutput = "";
			let verifpalOutputError = "";
			const verifpalProc = spawn(configDeterminePath(), args);
			verifpalProc.stdout.on('data', (data) => {
				verifpalOutput += data.toString();
			});
			verifpalProc.stderr.on('data', (data) => {
				verifpalOutputError += data.toString();
			});
			verifpalProc.on('exit', () => {
				if (verifpalOutputError) {
					reject(verifpalOutputError);
				} else {
					let result = verifpalOutput;
					resolve(result);
				}
			});
			verifpalProc.stdin.write(fileContents);
			verifpalProc.stdin.end();
		});
	}

	static getKnowledgeMapIndexFromConstant(constant: string, knowledgeMap) {
		for (let i = 0; i < knowledgeMap.Constants.length; i++) {
			if (knowledgeMap.Constants[i].Name === constant) {
				return i
			}
		}
		return -1
	}

	static getKnowledgeMap(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'knowledgeMap']);
	}

	static getPrettyValue(fileContents: string) {
		return VerifpalLib.execVerifpal(fileContents, ['internal-json', 'prettyValue']);
	}

	static getTypeAtPos(fileContents: string, fileName, pos: vscode.Position) {
	}

	static getDiagnostics(fileContents: string, fileName: string): any {
	}

	static getAutocomplete(fileContents: string, fileName: string, pos: vscode.Position): any {
	}

	static getDefinition(fileContents: string, fileName: string, pos: vscode.Position): any {
	}

	static getCoverage(fileContents: string, fileName: string): any {
	}
}
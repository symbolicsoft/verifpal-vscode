/* SPDX-FileCopyrightText: © 2019-2020 Nadim Kobeissi <nadim@symbolic.software>
 * SPDX-License-Identifier: GPL-3.0-only */

/// <reference path="./cross-spawn.d.ts" />
import { spawn } from 'cross-spawn';
import * as vscode from 'vscode';
import { configDeterminePath } from './config';
import * as path from 'path';
import * as fs from 'fs';

export default class VerifpalLib {
	static execVerifpal(fileContents, filename, args) {
		return new Promise((resolve, reject) => {
			if (!fs.existsSync(filename)) {
				resolve(undefined);
			}
			const cwd = path.dirname(filename);
			let verifpalOutput = "";
			let verifpalOutputError = "";
			const verifpalProc = spawn(configDeterminePath(), args, { cwd: cwd });
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
					if (verifpalOutput && verifpalOutput.length) {
						// result = JSON.parse(verifpalOutput);
						result = verifpalOutput;
					}
					resolve(result);
				}
			});
			verifpalProc.stdin.write(fileContents);
			verifpalProc.stdin.end();
		});
	}

	static getTypeAtPos(fileContents: string, fileName, pos: vscode.Position) {
		return VerifpalLib.execVerifpal(
			fileContents,
			fileName,
			['type-at-pos', '--json', '--pretty', '--path', fileName, pos.line + 1, pos.character + 1]);
	}

	static getDiagnostics(fileContents: string, fileName: string): any {
		return VerifpalLib.execVerifpal(
			fileContents,
			fileName,
			['status', '--json']);
	}

	static getAutocomplete(fileContents: string, fileName: string, pos: vscode.Position): any {
		return VerifpalLib.execVerifpal(
			fileContents,
			fileName,
			['autocomplete', '--json', fileName, pos.line + 1, pos.character + 1]);
	}

	static getDefinition(fileContents: string, fileName: string, pos: vscode.Position): any {
		return VerifpalLib.execVerifpal(
			fileContents,
			fileName,
			['get-def', '--json', fileName, pos.line + 1, pos.character + 1]);
	}

	static getCoverage(fileContents: string, fileName: string): any {
		return VerifpalLib.execVerifpal(
			fileContents,
			fileName,
			['coverage', '--json', fileName]);
	}
}
<!---
# SPDX-FileCopyrightText: © 2019-2021 Nadim Kobeissi <nadim@symbolic.software>
# SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Verifpal for Visual Studio Code

[![](https://img.youtube.com/vi/it_hJkVU-UA/0.jpg)](http://www.youtube.com/watch?v=it_hJkVU-UA "Verifpal for Visual Studio Code")

## What is Verifpal for Visual Studio Code?
Verifpal for Visual Studio Code is an extension that provides IDE features for the [Verifpal](https://verifpal.com) protocol modeling and analysis software within the popular Microsoft [Visual Studio Code](https://code.visualstudio.com/) editor. It is an official extension that is developed and maintained by the Verifpal project. **Verifpal for Visual Studio Code requires Verifpal 0.13.0 or higher to be installed for all functionality to work correctly.**

**Features**

- Syntax highlighting for Verifpal models.
- Formatting for Verifpal models using the standard Visual Studio Code API, including support for format-on-save.
- Immediate access to Verifpal documentation and code insights simply by hovering over terms with your cursor.
- Live diagram visualizations of Verifpal models within Visual Studio Code.
- Live analysis of Verifpal models and visual results feedback within Visual Studio Code.

## Getting Started
To install Verifpal for Visual Studio Code, simply search for it within the extensions search functionality of your Visual Studio Code Editor.

Syntax highlighting will be available immediately on `.vp` files. To format a model, simply right-click within the editor and select _"Format Document"_.

Hovering over primitives (such as `HKDF` or `AEAD_ENC`) will show documentation for these primitives. Hovering over constants will show their assigned values and the name of the principal that created them. Hovering over queries (such as `confidentiality`) will show a brief description of that query's syntax and functionality.

In order to show a diagram visualizing your protocol, open the Visual Studio Code Command Palette (`Ctrl+Shift+P` on Windows and Linux, `⌘+Shift+P` on macOS) and search for the _"Verifpal: Show Protocol Diagram"_ command.

In order to launch an analysis, open the Visual Studio Code Command Palette (`Ctrl+Shift+P` on Windows and Linux, `⌘+Shift+P` on macOS) and search for the _"Verifpal: Run Attacker Analysis"_ command. **It is recommended that this feature not be used for models which take a long time to be analyzed.** Using Verifpal in the command line for more complex models will likely yield a better workflow since you will not be able to edit your model while analysis is running.

Verifpal for Visual Studio Code may be configured via the following options in your Visual Studio Code User Settings file:

- `verifpal.enabled`: enables or disables IDE features. (eg. `true`)
- `verifpal.path`: Sets the path for the Verifpal binary on your computer. (eg. `/usr/local/bin/verifpal`)

**Note**: If you have installed Verifpal via the Snap Store, you will need to set `verifpal.path` to `/snap/verifpal/current/bin/verifpal`.

## Discussion
Sign up to the [Verifpal Mailing List](https://lists.symbolic.software/mailman/listinfo/verifpal) to stay informed on the latest news and announcements regarding Verifpal, and to participate in Verifpal discussions.

## License
Verifpal and Verifpal for Visual Studio Code are published by Symbolic Software. They are provided as free and open source software, licensed under the [GNU General Public License, version 3](https://www.gnu.org/licenses/gpl-3.0.en.html). The Verifpal User Manual is provided under the [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/) license.

© Copyright 2019-2021 Nadim Kobeissi. All Rights Reserved. “Verifpal” and the “Verifpal” logo/mascot are registered trademarks of Nadim Kobeissi.
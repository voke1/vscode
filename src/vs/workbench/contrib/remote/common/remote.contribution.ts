/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { ILabelService, ResourceLabelFormatting } from 'vs/platform/label/common/label';
import { OperatingSystem, isWeb } from 'vs/base/common/platform';
import { Schemas } from 'vs/base/common/network';
import { IRemoteAgentService, RemoteExtensionLogFileName } from 'vs/workbench/services/remote/common/remoteAgentService';
import { ILogService } from 'vs/platform/log/common/log';
import { LoggerChannelClient } from 'vs/platform/log/common/logIpc';
import { IOutputChannelRegistry, Extensions as OutputExt, } from 'vs/workbench/services/output/common/output';
import { localize } from 'vs/nls';
import { joinPath } from 'vs/base/common/resources';
import { Disposable } from 'vs/base/common/lifecycle';

export const VIEWLET_ID = 'workbench.view.remote';

export class LabelContribution implements IWorkbenchContribution {
	constructor(
		@ILabelService private readonly labelService: ILabelService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService) {
		this.registerFormatters();
	}

	private registerFormatters(): void {
		this.remoteAgentService.getEnvironment().then(remoteEnvironment => {
			if (remoteEnvironment) {
				const formatting: ResourceLabelFormatting = {
					label: '${path}',
					separator: remoteEnvironment.os === OperatingSystem.Windows ? '\\' : '/',
					tildify: remoteEnvironment.os !== OperatingSystem.Windows,
					normalizeDriveLetter: remoteEnvironment.os === OperatingSystem.Windows,
					workspaceSuffix: isWeb ? undefined : Schemas.vscodeRemote
				};
				this.labelService.registerFormatter({
					scheme: Schemas.vscodeRemote,
					formatting
				});
				this.labelService.registerFormatter({
					scheme: Schemas.userData,
					formatting
				});
			}
		});
	}
}

class RemoteChannelsContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@ILogService logService: ILogService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
	) {
		super();
		const connection = remoteAgentService.getConnection();
		if (connection) {
			const loggerClient = new LoggerChannelClient(connection.getChannel('logger'));
			loggerClient.setLevel(logService.getLevel());
			this._register(logService.onDidChangeLogLevel(level => loggerClient.setLevel(level)));
		}
	}
}

class RemoteLogOutputChannels implements IWorkbenchContribution {

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService
	) {
		remoteAgentService.getEnvironment().then(remoteEnv => {
			if (remoteEnv) {
				const outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels);
				outputChannelRegistry.registerChannel({ id: 'remoteExtensionLog', label: localize('remoteExtensionLog', "Remote Server"), file: joinPath(remoteEnv.logsPath, `${RemoteExtensionLogFileName}.log`), log: true });
			}
		});
	}
}

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(LabelContribution, LifecyclePhase.Starting);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteChannelsContribution, LifecyclePhase.Starting);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteLogOutputChannels, LifecyclePhase.Restored);

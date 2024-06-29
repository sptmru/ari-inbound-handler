import { Channel, Client } from 'ari-client';
import { PJSIPExtensionStatus } from '../types/PJSIPExtensionStatus';
import { AvailableAndBusyPJSIPExtensions } from '../types/AvailableAndBusyPJSIPExtensions';

export class PJSIPService {
  static async checkIfUserIsOnline(user: string, client: Client): Promise<boolean> {
    const endpoints = await client.endpoints.list();
    const userEndpoint = endpoints.find(endpoint => endpoint.resource === user);

    return userEndpoint !== undefined && userEndpoint.state === 'online';
  }

  static async checkIfUserIsAvailable(user: string, client: Client): Promise<boolean> {
    const channels = await client.channels.list();
    const userChannel = channels.find(channel => this.compareChannelWithUser(user, channel));

    return userChannel === undefined;
  }

  static async checkUserStatus(user: string, client: Client): Promise<PJSIPExtensionStatus> {
    const online = await this.checkIfUserIsOnline(user, client);
    const available = await this.checkIfUserIsAvailable(user, client);

    return { online, available };
  }

  static compareChannelWithUser(user: string, channel: Channel): boolean {
    const regex = /PJSIP\/(\d+)-/;
    const match = channel.name.match(regex);

    if (match && match[1] !== undefined) {
      return user === match[1];
    }

    return false;
  }

  static async findAvailableAndBusyUsers(users: string[], client: Client): Promise<AvailableAndBusyPJSIPExtensions> {
    const available: string[] = [];
    const busy: string[] = [];

    for (const user of users) {
      const userOnline = await this.checkIfUserIsOnline(user, client);
      if (!userOnline) {
        continue;
      }

      const userAvailable = await this.checkIfUserIsAvailable(user, client);
      userAvailable ? available.push(user) : busy.push(user);
    }

    return { available, busy };
  }
}

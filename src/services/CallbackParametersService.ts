export class CallbackService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static instance: CallbackService | null = null;
  protected channelIds: string[] = [];

  protected constructor() {}

  // eslint-disable-next-line no-shadow
  public static getInstance(): CallbackService {
    if (!CallbackService.instance) {
      CallbackService.instance = new CallbackService();
    }
    return CallbackService.instance;
  }

  addChannel(channelId: string): void {
    this.channelIds.push(channelId);
  }

  removeChannel(channelId: string): void {
    this.channelIds = this.channelIds.filter(id => id !== channelId);
  }

  checkChannel(channelId: string): boolean {
    return this.channelIds.includes(channelId);
  }
}

import { dataSource } from '../data-source';
import { ExtensionParameters } from '../entities/ExtensionParameters';

export class ExtensionParametersService {
  static async getExtensionStatus(extension: string): Promise<boolean> {
    const extensionData = await dataSource.getRepository(ExtensionParameters).findOne({ where: { extension } });
    return extensionData === null ? true : extensionData.is_active;
  }
}

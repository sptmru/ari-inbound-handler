import axios from 'axios';
import { config } from '../config/config';
import { PromptCitationData } from '../types/PromptCitationData';
import { logger } from '../misc/Logger';

export class CitationApiService {
  public static baseUrl = config.promptCitation.apiBaseUrl;

  static async sendNotificationRequest(promptCitationData: PromptCitationData): Promise<void> {
    const formData = new FormData();

    formData.append('extension', promptCitationData.extension);
    formData.append('court_id', promptCitationData.courtId.toString());
    formData.append('citation_number', promptCitationData.citationNumber);
    formData.append('caller_id_name', promptCitationData.callerIdName);
    formData.append('caller_id_number', promptCitationData.callerIdNumber);
    formData.append('dialed_phone_number', promptCitationData.dialedPhoneNumber);

    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/citation`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      logger.info(`Citation API request successful: ${response.status}`);
    } catch (err) {
      logger.error(`Citation API request failed: ${err.message}`);
    }
  }
}
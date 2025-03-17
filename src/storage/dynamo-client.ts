import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { AWS_REGION } from "../config/env";
import { createLogger } from "../utils/logger";

const logger = createLogger("dynamodb");

// DynamoDB client singleton
let dynamoClient: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

/**
 * Initialize the DynamoDB client
 */
export function initDynamoClient(): DynamoDBDocumentClient {
  if (docClient) {
    return docClient;
  }

  logger.info("Initializing DynamoDB client");

  try {
    dynamoClient = new DynamoDBClient({
      region: AWS_REGION,
      // maxAttempts: 5, // Auto-retry on failure
    });

    docClient = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        // Don't convert empty strings, empty sets or empty lists to null
        convertEmptyValues: false,
        // Don't remove undefined values
        removeUndefinedValues: false,
        // Convert JS numbers to strings for DynamoDB (safer for large numbers)
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        // Don't convert DynamoDB numbers to JS numbers (keeps them as strings)
        wrapNumbers: true,
      },
    });

    return docClient;
  } catch (error) {
    logger.error({ error }, "Failed to initialize DynamoDB client");
    throw new Error(
      `DynamoDB client initialization failed: ${(error as Error).message}`
    );
  }
}

/**
 * Get an item from DynamoDB by its primary key
 */
export async function getItem<T>(
  tableName: string,
  key: Record<string, any>
): Promise<T | null> {
  const client = initDynamoClient();

  try {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item as T;
  } catch (error) {
    logger.error({ error, tableName, key }, "Failed to get item from DynamoDB");
    throw new Error(
      `Failed to get item from DynamoDB: ${(error as Error).message}`
    );
  }
}

/**
 * Put an item into DynamoDB
 */
export async function putItem(
  tableName: string,
  item: Record<string, any>
): Promise<void> {
  const client = initDynamoClient();

  try {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });

    await client.send(command);
  } catch (error) {
    logger.error({ error, tableName }, "Failed to put item into DynamoDB");
    throw new Error(
      `Failed to put item into DynamoDB: ${(error as Error).message}`
    );
  }
}

/**
 * Update an item in DynamoDB
 */
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeNames: Record<string, string>,
  expressionAttributeValues: Record<string, any>
): Promise<void> {
  const client = initDynamoClient();

  try {
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await client.send(command);
  } catch (error) {
    logger.error(
      { error, tableName, key },
      "Failed to update item in DynamoDB"
    );
    throw new Error(
      `Failed to update item in DynamoDB: ${(error as Error).message}`
    );
  }
}

/**
 * Query items from DynamoDB using a partition key
 */
export async function queryItems<T>(
  tableName: string,
  keyConditionExpression: string,
  expressionAttributeNames: Record<string, string>,
  expressionAttributeValues: Record<string, any>,
  indexName?: string
): Promise<T[]> {
  const client = initDynamoClient();

  try {
    const command = new QueryCommand({
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    const response = await client.send(command);

    return (response.Items || []) as T[];
  } catch (error) {
    logger.error({ error, tableName }, "Failed to query items from DynamoDB");
    throw new Error(
      `Failed to query items from DynamoDB: ${(error as Error).message}`
    );
  }
}

/**
 * Delete an item from DynamoDB
 */
export async function deleteItem(
  tableName: string,
  key: Record<string, any>
): Promise<void> {
  const client = initDynamoClient();

  try {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    logger.error(
      { error, tableName, key },
      "Failed to delete item from DynamoDB"
    );
    throw new Error(
      `Failed to delete item from DynamoDB: ${(error as Error).message}`
    );
  }
}

/**
 * Scan all items in a DynamoDB table
 */
export async function scanItems<T>(
  tableName: string,
  filterExpression?: string,
  expressionAttributeNames?: Record<string, string>,
  expressionAttributeValues?: Record<string, any>
): Promise<T[]> {
  const client = initDynamoClient();

  try {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    const response = await client.send(command);

    return (response.Items || []) as T[];
  } catch (error) {
    logger.error({ error, tableName }, "Failed to scan items from DynamoDB");
    throw new Error(
      `Failed to scan items from DynamoDB: ${(error as Error).message}`
    );
  }
}

/**
 * Health check function for DynamoDB
 */
export async function pingDynamoDB(): Promise<boolean> {
  try {
    const client = initDynamoClient();
    // Simply list tables to check connection
    await client.send(
      new ScanCommand({
        TableName: "NONEXISTENT_TABLE",
        Limit: 1,
      })
    );
    return true;
  } catch (error) {
    // DynamoDB will return ResourceNotFoundException for non-existent table,
    // which is actually a successful connection
    if ((error as Error).name === "ResourceNotFoundException") {
      return true;
    }
    logger.error({ error }, "DynamoDB health check failed");
    return false;
  }
}

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

// Types matching the frontend
type Quality = 'approved' | 'rejected' | 'maybe';
type Character = 'sarang' | 'yeona' | 'other' | 'none';
type ActionTag = 'idle' | 'greeting' | 'reaction' | 'conversation' | 'locomotion' | 'combat';

interface Annotation {
  quality: Quality;
  character: Character;
  tags: ActionTag[];
  notes?: string;
  annotatedAt: string;
}

interface AnnotationRecord extends Annotation {
  userId: string;
  animationPath: string;
}

// Validation helpers
const VALID_QUALITIES: Quality[] = ['approved', 'rejected', 'maybe'];
const VALID_CHARACTERS: Character[] = ['sarang', 'yeona', 'other', 'none'];
const VALID_TAGS: ActionTag[] = ['idle', 'greeting', 'reaction', 'conversation', 'locomotion', 'combat'];

function isValidAnnotation(data: unknown): data is Annotation {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.quality === 'string' &&
    VALID_QUALITIES.includes(obj.quality as Quality) &&
    typeof obj.character === 'string' &&
    VALID_CHARACTERS.includes(obj.character as Character) &&
    Array.isArray(obj.tags) &&
    obj.tags.every((tag) => typeof tag === 'string' && VALID_TAGS.includes(tag as ActionTag)) &&
    typeof obj.annotatedAt === 'string'
  );
}

// Response helpers
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-User-Id',
    },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return jsonResponse(statusCode, { error: message });
}

// Handlers
async function getAnnotation(userId: string, animationPath: string): Promise<APIGatewayProxyResult> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId, animationPath },
    })
  );

  if (!result.Item) {
    return errorResponse(404, 'Annotation not found');
  }

  const { userId: _, animationPath: __, ...annotation } = result.Item as AnnotationRecord;
  return jsonResponse(200, annotation);
}

async function getAllAnnotations(
  userId: string,
  updatedSince?: string
): Promise<APIGatewayProxyResult> {
  const annotations: Record<string, Annotation> = {};
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  // Use GSI with annotatedAt for efficient filtering when updatedSince is provided
  const useIndex = !!updatedSince;

  do {
    const queryParams: {
      TableName: string;
      IndexName?: string;
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, string>;
      ExclusiveStartKey?: Record<string, unknown>;
    } = {
      TableName: TABLE_NAME,
      KeyConditionExpression: updatedSince
        ? 'userId = :userId AND annotatedAt > :since'
        : 'userId = :userId',
      ExpressionAttributeValues: updatedSince
        ? { ':userId': userId, ':since': updatedSince }
        : { ':userId': userId },
      ExclusiveStartKey: lastEvaluatedKey,
    };

    // Use GSI when filtering by time for better performance
    if (useIndex) {
      queryParams.IndexName = 'UserAnnotationsIndex';
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    for (const item of result.Items || []) {
      const record = item as AnnotationRecord;
      const { userId: _, animationPath, ...annotation } = record;
      annotations[animationPath] = annotation;
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return jsonResponse(200, { annotations });
}

async function putAnnotation(
  userId: string,
  animationPath: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    return errorResponse(400, 'Request body is required');
  }

  let annotation: Annotation;
  try {
    annotation = JSON.parse(body);
  } catch {
    return errorResponse(400, 'Invalid JSON in request body');
  }

  if (!isValidAnnotation(annotation)) {
    return errorResponse(400, 'Invalid annotation format');
  }

  const record: AnnotationRecord = {
    userId,
    animationPath,
    ...annotation,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
    })
  );

  return jsonResponse(200, { success: true });
}

async function deleteAnnotation(userId: string, animationPath: string): Promise<APIGatewayProxyResult> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userId, animationPath },
    })
  );

  return jsonResponse(200, { success: true });
}

async function batchImport(userId: string, body: string | null): Promise<APIGatewayProxyResult> {
  if (!body) {
    return errorResponse(400, 'Request body is required');
  }

  let data: { annotations: Record<string, Annotation> };
  try {
    data = JSON.parse(body);
  } catch {
    return errorResponse(400, 'Invalid JSON in request body');
  }

  if (!data.annotations || typeof data.annotations !== 'object') {
    return errorResponse(400, 'Invalid format: expected { annotations: {} }');
  }

  // Validate all annotations first
  for (const [path, annotation] of Object.entries(data.annotations)) {
    if (!isValidAnnotation(annotation)) {
      return errorResponse(400, `Invalid annotation for path: ${path}`);
    }
  }

  // Batch write in chunks of 25 (DynamoDB limit)
  const entries = Object.entries(data.annotations);
  const chunks: [string, Annotation][][] = [];
  for (let i = 0; i < entries.length; i += 25) {
    chunks.push(entries.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map(([animationPath, annotation]) => ({
            PutRequest: {
              Item: {
                userId,
                animationPath,
                ...annotation,
              },
            },
          })),
        },
      })
    );
  }

  return jsonResponse(200, { success: true, count: entries.length });
}

// Main handler
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, pathParameters, body, path, queryStringParameters } = event;
  const userId = pathParameters?.userId;
  const updatedSince = queryStringParameters?.updatedSince;

  // Route: POST /annotations/batch/{userId}
  if (path.includes('/batch/') && httpMethod === 'POST' && userId) {
    return batchImport(userId, body);
  }

  // Extract animationPath from path parameters (handles nested paths)
  const animationPath = pathParameters?.['animationPath+'] || pathParameters?.animationPath;

  try {
    // Routes for single annotation operations
    if (userId && animationPath) {
      // Decode the path (URL encoded)
      const decodedPath = decodeURIComponent(animationPath);

      switch (httpMethod) {
        case 'GET':
          return getAnnotation(userId, decodedPath);
        case 'PUT':
          return putAnnotation(userId, decodedPath, body);
        case 'DELETE':
          return deleteAnnotation(userId, decodedPath);
        default:
          return errorResponse(405, 'Method not allowed');
      }
    }

    // Route: GET /annotations/{userId} - get all annotations
    // Supports ?updatedSince=ISO8601_TIMESTAMP for incremental sync
    if (userId && httpMethod === 'GET') {
      return getAllAnnotations(userId, updatedSince);
    }

    return errorResponse(400, 'Invalid request');
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
}

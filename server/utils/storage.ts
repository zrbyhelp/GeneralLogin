import * as Minio from "minio";
import { createError } from "h3";
import { generateToken } from "~/server/utils/crypto";
import { getMinioConfig } from "~/server/utils/config";

type UploadedFile = {
  filename?: string;
  type?: string;
  data: Buffer;
};

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

let bucketReady: Promise<void> | null = null;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_SERVICE_FILE_SIZE = 10 * 1024 * 1024;

function parseEndpoint(value: string, port?: number, useSSL?: boolean) {
  if (!value) {
    throw createError({ statusCode: 500, statusMessage: "未配置 MinIO 服务" });
  }

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    return {
      endPoint: url.hostname,
      port: port || (url.port ? Number(url.port) : undefined),
      useSSL: typeof useSSL === "boolean" ? useSSL : url.protocol === "https:"
    };
  }

  return {
    endPoint: value,
    port,
    useSSL: useSSL ?? false
  };
}

function getClient() {
  const config = getMinioConfig();
  if (!config.accessKey || !config.secretKey) {
    throw createError({ statusCode: 500, statusMessage: "未配置 MinIO 凭据" });
  }
  if (!config.bucket) {
    throw createError({ statusCode: 500, statusMessage: "未配置 MinIO bucket" });
  }

  const connection = parseEndpoint(config.endpoint, config.port, config.useSSL);

  return {
    client: new Minio.Client({
      endPoint: connection.endPoint,
      port: connection.port,
      useSSL: connection.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    }),
    bucket: config.bucket,
    region: config.region,
    publicBaseUrl: config.publicBaseUrl
  };
}

async function ensureBucketExists() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { client, bucket, region } = getClient();
      const exists = await client.bucketExists(bucket).catch(() => false);
      if (!exists) {
        await client.makeBucket(bucket, region);
      }
    })();
  }

  return bucketReady;
}

function normalizeObjectPath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getFileExtension(file: UploadedFile) {
  const mime = (file.type || "").toLowerCase();
  if (mime in IMAGE_MIME_EXTENSIONS) {
    return IMAGE_MIME_EXTENSIONS[mime];
  }

  const name = file.filename || "";
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "bin";
}

function sanitizeFilename(value?: string) {
  const fallback = "upload.bin";
  const name = (value || fallback)
    .split(/[\\/]/)
    .pop()
    ?.trim() || fallback;
  const safe = name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe.slice(0, 120) || fallback;
}

function normalizePurpose(value?: string | null) {
  const purpose = (value || "files").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(purpose)) {
    throw createError({
      statusCode: 400,
      statusMessage: "上传用途只能包含字母、数字、下划线和短横线"
    });
  }

  return purpose;
}

function datePartition() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function validateImageUpload(file?: UploadedFile | null): asserts file is UploadedFile {
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: "请选择要上传的图片" });
  }

  if (!IMAGE_MIME_EXTENSIONS[file.type || ""]) {
    throw createError({ statusCode: 400, statusMessage: "仅支持 JPG、PNG、WEBP、GIF 图片" });
  }

  if (file.data.length > MAX_AVATAR_SIZE) {
    throw createError({ statusCode: 400, statusMessage: "图片不能超过 2MB" });
  }
}

export function validateServiceFileUpload(file?: UploadedFile | null): asserts file is UploadedFile {
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: "请选择要上传的文件" });
  }

  if (!file.data.length) {
    throw createError({ statusCode: 400, statusMessage: "不能上传空文件" });
  }

  if (file.data.length > MAX_SERVICE_FILE_SIZE) {
    throw createError({ statusCode: 400, statusMessage: "文件不能超过 10MB" });
  }
}

export async function uploadUserAvatarFile(params: {
  userId: string;
  file: UploadedFile | null;
}) {
  validateImageUpload(params.file);
  await ensureBucketExists();

  const { client, bucket, publicBaseUrl } = getClient();
  const ext = getFileExtension(params.file);
  const objectName = `avatars/${params.userId}/${Date.now()}-${generateToken(8)}.${ext}`;

  await client.putObject(bucket, objectName, params.file.data, params.file.data.length, {
    "Content-Type": params.file.type || "application/octet-stream"
  });

  return {
    bucket,
    objectName,
    url: buildPublicObjectUrl(objectName, publicBaseUrl, bucket)
  };
}

export async function uploadServiceFile(params: {
  serviceId: string;
  file: UploadedFile | null;
  userId?: string | null;
  purpose?: string | null;
}) {
  validateServiceFileUpload(params.file);
  await ensureBucketExists();

  const { client, bucket, publicBaseUrl } = getClient();
  const purpose = normalizePurpose(params.purpose);
  const filename = sanitizeFilename(params.file.filename);
  const owner = params.userId ? `users/${params.userId}` : "shared";
  const objectName = `services/${params.serviceId}/${purpose}/${owner}/${datePartition()}/${Date.now()}-${generateToken(8)}-${filename}`;

  await client.putObject(bucket, objectName, params.file.data, params.file.data.length, {
    "Content-Type": params.file.type || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`
  });

  return {
    bucket,
    objectName,
    filename,
    contentType: params.file.type || "application/octet-stream",
    size: params.file.data.length,
    url: buildPublicObjectUrl(objectName, publicBaseUrl, bucket)
  };
}

export function buildPublicObjectUrl(objectName: string, publicBaseUrl: string, bucket: string) {
  const base =
    publicBaseUrl ||
    `http://localhost:9000/${bucket}`;

  return `${base.replace(/\/$/, "")}/${normalizeObjectPath(objectName)}`;
}

export function getUploadedFileFromParts(
  parts: Array<{ name?: string; filename?: string; type?: string; data: Buffer }>,
  fieldName = "file"
) {
  return parts.find((part) => part.name === fieldName) || null;
}

export function getTextFromParts(
  parts: Array<{ name?: string; data: Buffer }>,
  fieldName: string
) {
  const part = parts.find((item) => item.name === fieldName);
  if (!part) {
    return "";
  }

  return part.data.toString("utf8").trim();
}

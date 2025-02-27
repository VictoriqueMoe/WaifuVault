import { Inject, Injectable } from "@tsed/di";
import { ThumbnailCacheDao } from "../dao/ThumbnailCacheDao.js";
import { ThumbnailCacheModel } from "../../model/db/ThumbnailCache.model.js";
import { REDIS_CONNECTION } from "../../model/di/tokens.js";
import type { RedisConnection } from "../../redis/Connection.js";
import { FileUploadModel } from "../../model/db/FileUpload.model.js";
import { FileUtils } from "../../utils/Utils.js";
import { EntityManager } from "typeorm";

@Injectable()
export class ThumbnailCacheRepo {
    public static readonly redisCachePrefix = "thumbnail:";
    public static readonly redisCacheTTL = 31536000;

    public constructor(
        @Inject() private thumbnailCacheDao: ThumbnailCacheDao,
        @Inject(REDIS_CONNECTION) private redis: RedisConnection,
    ) {}

    public async saveThumbnailCache(thumbnailCache: ThumbnailCacheModel): Promise<ThumbnailCacheModel> {
        const r = await this.thumbnailCacheDao.saveThumbnailCache(thumbnailCache);
        await this.redis.setex(
            `${ThumbnailCacheRepo.redisCachePrefix}${thumbnailCache.fileId}`,
            ThumbnailCacheRepo.redisCacheTTL,
            Buffer.from(thumbnailCache.data, "base64"),
        );
        return r;
    }

    public async saveThumbnailCaches(thumbnailCache: ThumbnailCacheModel[]): Promise<ThumbnailCacheModel[]> {
        const r = await this.thumbnailCacheDao.saveThumbnailCaches(thumbnailCache);
        const keyValuePairs: Array<string | Buffer> = [];

        for (const cache of r) {
            const key = `thumbnail:${cache.fileId}`;
            const value = Buffer.from(cache.data, "base64");
            keyValuePairs.push(key, value);
        }

        if (keyValuePairs.length > 0) {
            await this.redis.mset(...keyValuePairs);
        }

        return r;
    }

    public async deleteThumbnailCaches(fileIds: number[], transaction?: EntityManager): Promise<void> {
        if (fileIds.length === 0) {
            return;
        }
        await this.thumbnailCacheDao.deleteThumbnailCaches(fileIds, transaction);
        this.redis.del(...fileIds.map(id => `${ThumbnailCacheRepo.redisCachePrefix}${id}`));
    }

    public hasThumbnails(fileIds: number[]): Promise<number[]> {
        return this.thumbnailCacheDao.hasThumbnails(fileIds);
    }

    public async deleteThumbsIfExist(entries: FileUploadModel[], transaction?: EntityManager): Promise<void> {
        const hasThumbs = await this.hasThumbnails(entries.map(e => e.id));
        const thumbnailsToDelete = entries
            .filter(entry => hasThumbs.includes(entry.id) && FileUtils.isValidForThumbnail(entry))
            .map(entry => entry.id);

        await this.deleteThumbnailCaches(thumbnailsToDelete, transaction);
    }

    private async cacheRedis(thumbnailCache: ThumbnailCacheModel): Promise<void> {
        await this.redis.setex(
            `${ThumbnailCacheRepo.redisCachePrefix}${thumbnailCache.fileId}`,
            ThumbnailCacheRepo.redisCacheTTL,
            Buffer.from(thumbnailCache.data, "base64"),
        );
    }

    public async getThumbnailBuffer(fileId: number): Promise<Buffer | null> {
        const thumbnailFromRedis = await this.redis.getBuffer(`${ThumbnailCacheRepo.redisCachePrefix}${fileId}`);
        if (!thumbnailFromRedis || thumbnailFromRedis.length === 0) {
            const fromDb = await this.thumbnailCacheDao.getThumbnailCache(fileId);
            if (fromDb) {
                await this.cacheRedis(fromDb);
                return Buffer.from(fromDb.data, "base64");
            }
            return null;
        }
        return thumbnailFromRedis;
    }
}

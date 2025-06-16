"use server";

import { db } from "@/drizzle/db";
import { user, videos } from "@/drizzle/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "../auth";
import {
  apiFetch,
  doesTitleMatch,
  getEnv,
  getOrderByClause,
  withErrorHandling,
} from "./../utils";
import { BUNNY } from "@/constants";
import aj, { fixedWindow, request } from "../arcjet";

// Constants with full names
const VIDEO_STREAN_BASE_URL = BUNNY.STREAM_BASE_URL;
const THUMBNAILS_STORAGE_BASE_URL = BUNNY.STORAGE_BASE_URL;
const THUMBNAILS_CDN_URL = BUNNY.CDN_URL;
const BUNNY_LIBRARY_ID = getEnv("BUNNY_LIBRARY_ID");
const ACCESS_KEY = {
  streamAccessKey: getEnv("BUNNY_STREAM_ACCESS_KEY"),
  storageAccessKey: getEnv("BUNNY_STORAGE_ACCESS_KEY"),
};

// Regule upload video per minute with Arcjet
const validateWithArcjet = async (fingerprint: string) => {
  const rateLimit = aj.withRule(
    fixedWindow({
      mode: "LIVE",
      window: "1m",
      max: 2,
      characteristics: ["fingerprint"],
    })
  );

  const req = await request();
  const decision = await rateLimit.protect(req, { fingerprint });

  if (decision.isDenied()) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }
};

//** Helper functions **/
const getSessionUserId = async (): Promise<string> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) throw new Error("User not authenticated");

  return session.user.id;
};

const revalidatePaths = (paths: string[]) => {
  paths.forEach((path) => revalidatePath(path));
};

const buildVideoWithUserQuery = () => {
  return db
    .select({
      video: videos,
      user: { id: user.id, name: user.name, image: user.image },
    })
    .from(videos)
    .leftJoin(user, eq(videos.userId, user.id));
};

//** Server Actions **/

// Upload video URL
export const getVideoUploadUrl = withErrorHandling(async () => {
  await getSessionUserId();

  const videoResponse = await apiFetch<BunnyVideoResponse>(
    `${VIDEO_STREAN_BASE_URL}/${BUNNY_LIBRARY_ID}/videos`,
    {
      method: "POST",
      bunnyType: "stream",
      body: {
        title: "Temporary Title",
        collectionId: "",
      },
    }
  );

  const uploadUrl = `${VIDEO_STREAN_BASE_URL}/${BUNNY_LIBRARY_ID}/videos/${videoResponse.guid}`;

  return {
    videoId: videoResponse.guid,
    uploadUrl,
    accessKey: ACCESS_KEY.streamAccessKey,
  };
});

// Upload thumbnail URL
export const getThumbnailUploadUrl = withErrorHandling(
  async (videoId: string) => {
    const fileName = `${Date.now()}-${videoId}.thumbnail`;
    const uploadUrl = `${THUMBNAILS_STORAGE_BASE_URL}/thumbnails/${fileName}`;
    const cdnUrl = `${THUMBNAILS_CDN_URL}/thumbnails/${fileName}`;

    return {
      uploadUrl,
      cdnUrl,
      accessKey: ACCESS_KEY.storageAccessKey,
    };
  }
);

export const saveVideoDetails = withErrorHandling(
  async (videoDetails: VideoDetails) => {
    const userId = await getSessionUserId();
    // Validate user upload rate limit
    await validateWithArcjet(userId);

    // update title & description
    await apiFetch(
      `${VIDEO_STREAN_BASE_URL}/${BUNNY_LIBRARY_ID}/videos/${videoDetails.videoId}`,
      {
        method: "POST",
        bunnyType: "stream",
        body: {
          title: videoDetails.title,
          description: videoDetails.description,
        },
      }
    );
    await db.insert(videos).values({
      ...videoDetails,
      videoUrl: `${BUNNY.EMBED_URL}/${BUNNY_LIBRARY_ID}/${videoDetails.videoId}`,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      visibility: videoDetails.visibility as "public" | "private",
    });

    revalidatePaths(["/"]);

    return { videoId: videoDetails.videoId };
  }
);

export const getAllVideos = withErrorHandling(
  async (
    searchQuery: string = "",
    sortFilter?: string,
    pageNumber: number = 1,
    pageSize: number = 8
  ) => {
    const session = await auth.api.getSession({ headers: await headers() });
    const currentUserId = session?.user.id;

    const canSeeTheVideos = or(
      eq(videos.visibility, "public"),
      eq(videos.userId, currentUserId!)
    );
    // console.log("canSeeTheVideos SQL:", canSeeTheVideos);

    const whereCondition = searchQuery.trim()
      ? and(canSeeTheVideos, doesTitleMatch(videos, searchQuery))
      : canSeeTheVideos;

    // Count total for pagination
    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)` })
      .from(videos)
      .where(whereCondition);
    const totalVideos = Number(totalCount || 0);
    const totalPages = Math.ceil(totalVideos / pageSize);

    // Fetch paginated, sorted results
    const videoRecords = await buildVideoWithUserQuery()
      .where(whereCondition)
      .orderBy(
        sortFilter
          ? getOrderByClause(sortFilter)
          : sql`${videos.createdAt} DESC`
      )
      .limit(pageSize)
      .offset((pageNumber - 1) * pageSize);

    return {
      videos: videoRecords,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalVideos,
        pageSize,
      },
    };
  }
);

export const getVideoById = withErrorHandling(async (videoId: string) => {
  const [videoRecord] = await buildVideoWithUserQuery()
  .where(eq(videos.id, videoId))
  
  return videoRecord;
})

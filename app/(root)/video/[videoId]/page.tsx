import VideoPlayer from "@/components/VideoPlayer"
import { getVideoById } from "@/lib/actions/video"

const page = async ({ params }: Params) => {
  const { videoId } = await params

  const { user, video } = await getVideoById(videoId)

  if (!video) {
    return (
      <main className='wrapper page'>
        <h1>Video not found</h1>
      </main>
    )
  }
  return (
    <main className='wrapper page'>
      <VideoPlayer videoId={video.id} />
    </main>
  )
}

export default page
const PROMPTS = {
  walk_to_bar: '像素风植物小精灵侧视图，面朝右，从画面左侧一步一步走向右侧魔法酒馆吧台；角色必须是侧面走路姿势，有清楚的四帧走路节奏，不要正面站立，不要漂浮。浅蓝白色背景，夏季清凉魔法城堡氛围，动作短循环，透明感，不能写字。',
  daily: '像素风植物小精灵拿着调酒杯轻轻摇杯，旁边有一张今日小票，浅蓝和淡黄色配色，动作短循环，透明感，不能写字。',
  free_time: '像素风植物小精灵坐在吧台边，旁边放一杯小点心和清凉饮品，轻轻晃腿，浅蓝和粉黄色配色，动作短循环，不能写字。',
  long_goal: '像素风植物小精灵在小酒桶旁慢慢酿造，酒桶上有星星与小植物，浅蓝和淡黄色配色，动作短循环，不能写字。',
  brewing: '像素风植物小精灵在吧台后制作饮品，双手摇动调酒壶，杯子轻微发光，动作短循环，浅蓝白和淡黄色，不能写字。',
}

function extractVideoUrl(result) {
  const data = result?.data || result
  return (
    data?.video_url ||
    data?.url ||
    data?.output?.video_url ||
    data?.output?.url ||
    data?.data?.video_url ||
    data?.data?.url ||
    data?.result?.video_url ||
    data?.result?.url ||
    ''
  )
}

export async function requestSeedanceMotion({ scene, mode, bartender, referenceImage }) {
  const key = scene || mode || 'daily'
  const name = bartender?.name || '种种'
  const personality = bartender?.style || bartender?.reminderTone || '植物调酒师'
  const prompt = `${PROMPTS[key] || PROMPTS.daily} 主角是${name}，性格气质：${personality}。整体必须保持已有种种的可爱像素风，不要矢量扁平风，不要厚重渐变。`
  try {
    const res = await fetch('/api/seedance/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scene: key,
        mode: mode || key,
        prompt,
        referenceImage,
        duration: 4,
        resolution: '720p',
        aspectRatio: '1:1',
      }),
    })
    const result = await res.json().catch(() => ({}))
    const videoUrl = extractVideoUrl(result)
    return {
      ok: res.ok && Boolean(videoUrl),
      videoUrl,
      fallback: !videoUrl,
      result,
    }
  } catch {
    return { ok: false, videoUrl: '', fallback: true }
  }
}

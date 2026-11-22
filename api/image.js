export default async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Method not allowed."})}
  const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!accountId||!token)return res.status(503).json({error:"Image generation is not configured yet. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel."});
  const {prompt,shape="square",style="photorealistic"}=req.body||{};
  if(typeof prompt!=="string"||!prompt.trim())return res.status(400).json({error:"Enter an image description."});
  if(prompt.length>1200)return res.status(400).json({error:"Keep the image description under 1,200 characters."});
  const sizes={square:[1024,1024],portrait:[768,1344],landscape:[1344,768]};
  if(!sizes[shape])return res.status(400).json({error:"Choose a supported image shape."});
  const [width,height]=sizes[shape];
  const fullPrompt=prompt.trim()+", "+String(style||"photorealistic").slice(0,40)+" style";
  try{
    const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(accountId)+"/ai/run/@cf/black-forest-labs/flux-1-schnell",{
      method:"POST",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({prompt:fullPrompt,width,height})
    });
    if(!response.ok){
      const detail=await response.text();
      console.error("Cloudflare image generation failed:",response.status,detail.slice(0,500));
      if(response.status===401||response.status===403)return res.status(502).json({error:"Cloudflare rejected the API token or model permission. Check the token permissions."});
      if(response.status===429)return res.status(429).json({error:"Cloudflare image generation limit reached. Try again later."});
      return res.status(502).json({error:"Cloudflare could not generate this image. Check your Workers AI account and try again."});
    }
    const contentType=response.headers.get("content-type")||"image/png";
    if(!contentType.startsWith("image/")){const detail=await response.text();console.error("Unexpected Cloudflare image response:",detail.slice(0,400));return res.status(502).json({error:"The image provider returned an unexpected response."})}
    const bytes=Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type",contentType);
    res.setHeader("Content-Length",String(bytes.length));
    res.setHeader("Cache-Control","no-store");
    return res.status(200).send(bytes);
  }catch(error){console.error("Cloudflare image request error:",error);return res.status(502).json({error:"Unable to reach the image generation service."})}
}
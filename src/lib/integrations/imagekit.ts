import ImageKit from "imagekit";

export function getImageKitClient() {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || "public_mraru_demo_key";
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "private_mraru_demo_key";
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/mraru";

  return new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });
}

export function getImageKitAuthParams() {
  try {
    const imagekit = getImageKitClient();
    return imagekit.getAuthenticationParameters();
  } catch (err) {
    // Return mock parameters for demo mode
    return {
      token: `token_${Date.now()}`,
      expire: Math.floor(Date.now() / 1000) + 1800,
      signature: "mock_imagekit_signature_mraru",
    };
  }
}

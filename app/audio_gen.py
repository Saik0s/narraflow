from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs
from minio import Minio
from minio.error import S3Error
from fastapi import HTTPException
import os
import io
import uuid
from datetime import datetime
from pydantic import BaseModel

class AudioGenerationRequest(BaseModel):
    text: str

class AudioResponse(BaseModel):
    url: str

async def generate_audio(text: str) -> AudioResponse:
    try:
        # Initialize ElevenLabs client
        client = ElevenLabs(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
        )

        # Generate audio bytes
        audio_response = client.text_to_speech.convert(
            voice_id="pNInz6obpgDQGcFmaJgB",  # Adam pre-made voice
            output_format="mp3_22050_32",
            text=text,
            model_id="eleven_turbo_v2_5",
            voice_settings=VoiceSettings(
                stability=0.0,
                similarity_boost=1.0,
                style=0.0,
                use_speaker_boost=True,
            ),
        )

        # Collect all chunks into a single bytes object
        audio_bytes = b''
        for chunk in audio_response:
            if chunk:
                audio_bytes += chunk

        # Initialize MinIO client
        minio_client = Minio(
            os.getenv("MINIO_ENDPOINT", "minio:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=False  # Set to True if using HTTPS
        )

        bucket_name = os.getenv("MINIO_BUCKET_NAME", "audio-files")

        # Ensure bucket exists
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)

        # Create unique filename using UUID
        filename = f"audio_{uuid.uuid4()}.mp3"

        # Upload to MinIO
        audio_bytes_io = io.BytesIO(audio_bytes)
        minio_client.put_object(
            bucket_name,
            filename,
            audio_bytes_io,
            length=len(audio_bytes),
            content_type="audio/mpeg"
        )

        # Generate URL
        url = minio_client.presigned_get_object(
            bucket_name,
            filename,
            expires=7 * 24 * 60 * 60  # URL expires in 7 days
        )

        return AudioResponse(url=url)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

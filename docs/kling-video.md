# Video Generation - Image to Video

## Create Task

| Protocol | Request URL | Request Method | Request Format | Response Format |
|----------|-------------|----------------|----------------|-----------------|
| https | `/v1/videos/image2video` | POST | application/json | application/json |

### Request Header

| Field | Value | Description |
|-------|-------|-------------|
| Content-Type | application/json | Data Exchange Format |
| Authorization | Authentication information, refer to API authentication | Authentication information, refer to API authentication |

### Request Body

> **Note:** To maintain naming consistency, the original `model` field has been changed to `model_name`. Please use this field to specify the version of the model to call.
>
> For backward compatibility, using the original `model` field will not cause exceptions—it is equivalent to the default behavior when `model_name` is empty (i.e., call the V1 model).

#### Example Request

```bash
curl --location --request POST 'https://api-singapore.klingai.com/v1/videos/image2video' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data-raw '{
    "model_name": "kling-v1",
    "mode": "pro",
    "duration": "5",
    "image": "https://h2.inkwai.com/bs2/upload-ylab-stunt/se/ai_portal_queue_mmu_image_upscale_aiweb/3214b798-e1b4-4b00-b7af-72b5b0417420_raw_image_0.jpg",
    "prompt": "The astronaut stood up and walked away",
    "cfg_scale": 0.5,
    "static_mask": "https://h2.inkwai.com/bs2/upload-ylab-stunt/ai_portal/1732888177/cOLNrShrSO/static_mask.png",
    "dynamic_masks": [
      {
        "mask": "https://h2.inkwai.com/bs2/upload-ylab-stunt/ai_portal/1732888130/WU8spl23dA/dynamic_mask_1.png",
        "trajectories": [
          {"x":279,"y":219},{"x":417,"y":65}
        ]
      }
    ]
}'
```

### Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `model_name` | string | Optional | kling-v1 | Model Name. Enum values: `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1`, `kling-v2-1-master`, `kling-v2-5-turbo`, `kling-v2-6` |
| `image` | string | Required | Null | Reference Image. Supports Base64 encoding or image URL (ensure accessibility). See [Image Format Requirements](#image-format-requirements). |
| `image_tail` | string | Optional | Null | Reference Image - End frame control. Supports Base64 encoding or image URL. See [Image Format Requirements](#image-format-requirements). |
| `prompt` | string | Optional | None | Positive text prompt. Max 2500 characters. Use `<<<voice_1>>>` to specify voice (same sequence as `voice_list`). Max 2 tones per task. |
| `negative_prompt` | string | Optional | Null | Negative text prompt. Max 2500 characters. |
| `voice_list` | array | Optional | None | List of tones for video generation. Max 2 voices. Only V2.6+ models supported. |
| `sound` | string | Optional | off | Generate sound with video. Enum: `on`, `off`. Only V2.6+ models supported. |
| `cfg_scale` | float | Optional | 0.5 | Flexibility in video generation. Higher value = lower flexibility, stronger relevance to prompt. Range: `[0, 1]`. Not supported by kling-v2.x models. |
| `mode` | string | Optional | std | Video generation mode. `std`: Standard Mode (cost-effective), `pro`: Professional Mode (longer duration, higher quality). |
| `static_mask` | string | Optional | null | Static Brush Application Area (mask image). Supports Base64 or URL. |
| `dynamic_masks` | array | Optional | null | Dynamic Brush Configuration List. Up to 6 groups, each with mask area and motion trajectories. |
| `camera_control` | object | Optional | Null | Camera movement control terms. |
| `duration` | string | Optional | 5 | Video length in seconds. Enum: `5`, `10` |
| `callback_url` | string | Optional | None | Callback notification URL for task status changes. |
| `external_task_id` | string | Optional | None | Custom Task ID. Must be unique within user account. |

### Image Format Requirements

- Supported formats: `.jpg`, `.jpeg`, `.png`
- Max file size: 10MB
- Min dimensions: 300px (width and height)
- Aspect ratio: 1:2.5 ~ 2.5:1
- At least one of `image` or `image_tail` must be provided
- `image+image_tail`, `dynamic_masks/static_mask`, and `camera_control` cannot be used simultaneously

**Base64 Encoding:**
When using Base64, do not include prefixes like `data:image/png;base64,`.

✅ Correct:
```
iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
```

❌ Incorrect:
```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
```

### Voice List Format

```json
"voice_list": [
  {"voice_id": "voice_id_1"},
  {"voice_id": "voice_id_2"}
]
```

### Dynamic Masks Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `dynamic_masks.mask` | string | Optional | null | Dynamic Brush Application Area. Supports Base64 or URL. Aspect ratio must match input image. |
| `dynamic_masks.trajectories` | array | Optional | null | Motion trajectory coordinate sequence. For 5s video: 2-77 coordinates. Coordinate origin is bottom-left corner. |
| `dynamic_masks.trajectories.x` | int | Optional | null | Horizontal coordinate (X) of trajectory point. |
| `dynamic_masks.trajectories.y` | int | Optional | null | Vertical coordinate (Y) of trajectory point. |

### Camera Control Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `camera_control.type` | string | Optional | None | Predefined camera movement type. Enum: `simple`, `down_back`, `forward_up`, `right_turn_forward`, `left_turn_forward` |
| `camera_control.config` | object | Optional | None | Camera movement configuration. Required when type is `simple`; leave blank for other types. |

**Camera Control Types:**

| Type | Description | Config Required |
|------|-------------|-----------------|
| `simple` | Camera movement (choose one of six options in config) | Yes |
| `down_back` | Camera descends and moves backward (Pan down and zoom out) | No (set to None) |
| `forward_up` | Camera moves forward and tilts up (Zoom in and pan up) | No (set to None) |
| `right_turn_forward` | Rotate right and move forward | No (set to None) |
| `left_turn_forward` | Rotate left and move forward | No (set to None) |

**Config Parameters** (choose one, set others to zero):

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `config.horizontal` | float | [-10, 10] | Camera movement along horizontal axis. Negative = left, Positive = right |
| `config.vertical` | float | [-10, 10] | Camera movement along vertical axis. Negative = down, Positive = up |
| `config.pan` | float | [-10, 10] | Rotation in vertical plane (around x-axis). Negative = down, Positive = up |
| `config.tilt` | float | [-10, 10] | Rotation in horizontal plane (around y-axis). Negative = left, Positive = right |
| `config.roll` | float | [-10, 10] | Rolling amount (around z-axis). Negative = counterclockwise, Positive = clockwise |
| `config.zoom` | float | [-10, 10] | Focal length change. Negative = narrower FOV, Positive = wider FOV |

### Response Body

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

| Field | Description |
|-------|-------------|
| `code` | Error code (see Error Code documentation) |
| `message` | Error information |
| `request_id` | Request ID (system generated) |
| `data.task_id` | Task ID (system generated) |
| `data.task_status` | Task status. Enum: `submitted`, `processing`, `succeed`, `failed` |
| `data.task_info.external_task_id` | Customer-defined task ID |
| `data.created_at` | Task creation time (Unix timestamp, ms) |
| `data.updated_at` | Task update time (Unix timestamp, ms) |

---

## Query Task (Single)

| Protocol | Request URL | Request Method | Request Format | Response Format |
|----------|-------------|----------------|----------------|-----------------|
| https | `/v1/videos/image2video/{id}` | GET | application/json | application/json |

### Request Header

| Field | Value | Description |
|-------|-------|-------------|
| Content-Type | application/json | Data Exchange Format |
| Authorization | Authentication information | Refer to API authentication |

### Request Path Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `task_id` | string | Optional | None | Task ID for Image to Video (fill directly in request path) |
| `external_task_id` | string | Optional | None | Customized Task ID (fill directly in request path) |

> **Note:** Choose to query by either `external_task_id` or `task_id`.

### Response Body

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "string",
    "task_status_msg": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "created_at": 1722769557708,
    "updated_at": 1722769557708,
    "task_result": {
      "videos": [
        {
          "id": "string",
          "url": "string",
          "duration": "string"
        }
      ]
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `task_status_msg` | Task status information (displays failure reason when task fails) |
| `task_result.videos[].id` | Generated video ID (globally unique) |
| `task_result.videos[].url` | URL for generated video. Videos are cleared after 30 days—save promptly. |
| `task_result.videos[].duration` | Total video duration in seconds |

---

## Query Task (List)

| Protocol | Request URL | Request Method | Request Format | Response Format |
|----------|-------------|----------------|----------------|-----------------|
| https | `/v1/videos/image2video` | GET | application/json | application/json |

### Request Header

| Field | Value | Description |
|-------|-------|-------------|
| Content-Type | application/json | Data Exchange Format |
| Authorization | Authentication information | Refer to API authentication |

### Query Parameters

Example: `/v1/videos/image2video?pageNum=1&pageSize=30`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pageNum` | int | Optional | 1 | Page number. Range: [1, 1000] |
| `pageSize` | int | Optional | 30 | Data volume per page. Range: [1, 500] |

### Response Body

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": [
    {
      "task_id": "string",
      "task_status": "string",
      "task_status_msg": "string",
      "task_info": {
        "external_task_id": "string"
      },
      "created_at": 1722769557708,
      "updated_at": 1722769557708,
      "task_result": {
        "videos": [
          {
            "id": "string",
            "url": "string",
            "duration": "string"
          }
        ]
      }
    }
  ]
}
```

---

## Important Notes

- Generated images/videos are cleared after **30 days**. Save them promptly.
- The support range for different model versions and video modes varies. Refer to the Capability Map documentation.
- For voice generation billing, when `voice_list` is not empty and `prompt` references a voice ID, the task will be billed based on "with voice generation" metric.
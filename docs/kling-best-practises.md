# KLING AI Guide (Video)

🎬 **ABOUT KLING:** Kling, developed by the large model team of Kuaishou, is a self-developed video generation large model that now supports capabilities such as Text-to-Video, Image-to-Video, Extend with Prompts, camera motion control, and keyframe editing, allowing users to easily and efficiently complete artistic video creation.

🔗 **LINK TO KLING AI:** [https://klingai.com/text-to-video/new](https://klingai.com/text-to-video/new)

---

## Table of Contents

1. [Essential Functions](#1-essential-functions)
   - [Text-to-Video](#text-to-video)
   - [Image-to-Video](#image-to-video)
   - [Elements](#elements)
   - [Extend with Prompts](#extend-with-prompts)
2. [Advanced Functions](#2-advanced-functions)
   - [Standard Mode & Professional Mode](#standard-mode--professional-mode)
   - [Camera Movement](#camera-movement)
   - [Start and End Frames](#start-and-end-frames)
   - [Motion Brush](#motion-brush)
   - [Lip Sync](#lip-sync)
3. [Scenario Applications](#3-scenario-applications)

---

## 1. Essential Functions

### Text-to-Video

By inputting a text passage, the Kling large model generates a 5-second or 10-second video that translates the text into visual imagery. It currently supports two modes of generation:

- **Standard Mode** - for quicker video production
- **Professional Mode** - for superior image quality

Kling also supports three aspect ratios: **16:9**, **9:16**, and **1:1**, to meet diverse video creation requirements.

#### The Prompt Formula

💡 **Prompt = Subject (Subject Description) + Subject Movement + Scene (Scene Description) + (Camera Language + Lighting + Atmosphere) — optional**

| Component | Description |
|-----------|-------------|
| **Subject** | The main focus in the video, serving as an important embodiment of the theme. It can be people, animals, plants, objects, etc. |
| **Subject Description** | Descriptions of the subject's appearance details and body posture using multiple short sentences (e.g., athletic performance, hairstyle and color, clothing and accessories, facial features, body posture) |
| **Subject Movement** | Descriptions of the subject's movement status, including stillness and motion; should be straightforward and suitable for a 5-second video |
| **Scene** | The environment in which the subject is situated, encompassing the foreground, background, and other elements |
| **Scene Description** | Concise and focused descriptions of the subject's environment using a few short sentences (e.g., indoor scene, outdoor setting, natural scene) |
| **Camera Language** | Various applications of the camera lens, along with transitions and edits between shots (e.g., ultra-wide angle shots, bokeh, close-ups, telephoto shots, low-angle shots, high-angle shots, aerial views, depth of field) |
| **Lighting** | Light and shadow elements that imbue photographic works with soul (e.g., ambient lighting, morning light, sunset, interplay of light and shadow, Tyndall effect, artificial lighting) |
| **Atmosphere** | Describing the atmosphere of the anticipated video footage to set the mood and tone |

#### Example: Giant Panda in a Café

| Prompt Level | Prompt |
|--------------|--------|
| Basic | A giant panda is reading a book in a café. |
| Enhanced Details | A giant panda wearing black-framed glasses is reading a book in a café, with the book placed on the table. On the table, there is also a cup of coffee emitting steam, and next to it is the café's window. |
| Cinematic | In the shot, a medium shot with a blurred background and ambient lighting captures a scene where a giant panda, adorned with black-framed glasses, is reading a book in a café. The book rests on the table, accompanied by a cup of coffee that's steaming gently. Beside the cozy setting is the café's window, with a cinematic color grading applied to enhance the visual. |

#### High-Quality Example Prompts

**Animals & Characters:**
- "A giant panda is eating hot pot with chopsticks, with the street as the background." (16:9, Standard, 5s)
- "A Pikachu is sitting on a chair, drinking coffee and reading a newspaper." (16:9, Standard, 5s)
- "A polar bear is playing the violin in the snow." (16:9, Standard, 5s)
- "A bee with a puppy's head" (16:9, Standard, 5s)

**Portraits:**
- "Morning mist, sunrise, lens flare, and a cool breeze. A young Chinese woman with exquisite facial features, her long hair blown by the wind, strands of hair scattered across her face, dressed in summer attire, with a seaside beach as the backdrop." (16:9, Standard, 5s)
- "Indoor shooting, close-up, a Chinese child is eating dumplings." (16:9, Standard, 5s)
- "A Chinese little girl is holding a pink balloon and smiling happily in the playground, with a slide in the background." (16:9, Standard, 5s)

**Scenes & Landscapes:**
- "Aerial shot, blue waves pounding against the rocks, a magnificent and magnificent scene." (16:9, Standard, 10s)
- "A medieval sailing ship sailing on the sea, a foggy night, bright moonlight, and an eerie atmosphere." (16:9, Standard, 5s)
- "First-person perspective, high-speed flight, symmetrical composition, rotation, countless lightning bolts amidst dark clouds, motion blur." (16:9, Standard, 5s)

**Sci-Fi & Cyberpunk:**
- "A space fighter jet speeds through a huge sci-fi internal tunnel, rushes out of the tunnel into space, and a space battle can be seen at the end of the tunnel." (16:9, Standard, 5s)
- "A racing car is racing on the surface of the moon against a space backdrop, with tilt-shift zoom effect." (16:9, Professional, 5s)
- "Aerial shot of a cyberpunk city." (16:9, Standard, 10s)
- "On an alien planet, the streetscape of a cyberpunk city, with futuristic buildings, the camera slowly advances forward, and there are pedestrians on the street." (16:9, Professional, 5s)

**Cinematic Scenes:**
- "A woman is engaged in a gunfight with someone in an alley, with a Blade Runner-style atmosphere, neon lights, and ambient lighting." (16:9, Professional, 5s)
- "First-person perspective, a man driving a car on a night street with fireworks blooming ahead." (16:9, Standard, 5s)
- "A circling camera shot captures a handsome young man dressed in ancient clothing, wearing white, seated by the pond with his eyes closed, meditating." (16:9, Professional, 5s)
- "The back view of a woman, in a red long gown, standing on the rooftop, with buildings smoking in the distance." (16:9, Standard, 5s)

#### Tips for Text-to-Video

- Use simple words and sentence structures, avoiding overly complex language
- Keep the visual content as simple as possible, aiming for completion within 5 to 10 seconds
- Using words like "Oriental mood," "China," and "Asia" can more easily generate a Chinese style and depict Chinese people
- Current large video models are not sensitive to numbers, making it difficult to maintain consistency in counts (e.g., "10 puppies on the beach")
- For a split-screen scene, use a prompt like: "4 camera angles, representing spring, summer, autumn, and winter"
- At the current stage, it is challenging to generate complex physical movements (e.g., bouncing of a ball or trajectory of a high-altitude throw)

---

### Image-to-Video

By inputting an image, the Kling large model generates a 5-second or 10-second video that animates the image into moving visuals. With the addition of a text description, Kling can produce a video sequence that integrates the text's narrative with the image.

Image-to-Video offers greater control over the video creation process, reducing professional video production costs and entry barriers. Popular creative trends include "reviving old photos," "embracing your younger self," and creative transformations.

#### The Prompt Formula

💡 **Prompt = Subject + Movement, Background + Movement ······**

| Component | Description |
|-----------|-------------|
| **Subject** | The main focus in the video (people, animals, plants, objects, etc.) |
| **Movement** | Descriptions of the subject's movement status |
| **Background** | Background of the scene |

#### Example: Mona Lisa with Sunglasses

| Prompt | Result |
|--------|--------|
| Put on sunglasses | Model may not understand the instruction clearly |
| Mona Lisa puts on sunglasses with her hand | Better understanding and execution |
| Mona Lisa puts on sunglasses with her hand, and a ray of light appears in the background | Multiple subjects with movements |

#### High-Quality Example Prompts

**People:**
- "Two people hugging each other"
- "Two boys hugging each other"
- "The little boy smiles at the camera"
- "A beautiful Chinese girl looks into the distance and smiles"

**Animals:**
- "A cat is kneading dough in the kitchen"
- "The red-crowned crane is looking for food"
- "The panda is eating an apple"

**Dynamic Scenes:**
- "The model is smiling with her hair blown by the wind"
- "The athlete is cycling on the highway with a sense of speed"
- "Flying dust and floating clothes"

#### Tips for Image-to-Video

- Use simple words and sentence structures, avoiding overly complex language
- Movement should comply with the laws of physics; describe movements that are likely to occur in the image
- A description that significantly deviates from the image may cause a camera cut or transition
- Complex physical movements remain challenging to generate

---

### Elements

The Elements feature is available with the **KLING AI 1.6 model** for Image to Video generation. Upload 1-4 images, select the subjects (people, animals, objects, or scenes) as elements, and describe their actions and interactions.

#### Use Case 1: Character Consistency

Upload one or multiple images as elements of a subject to create videos with consistent character appearance across different shots.

| Elements | Prompt | Result Description |
|----------|--------|-------------------|
| Girl image + clothes + crown | On the stage, a girl wearing fashionable clothes and a crystal crown calmly gazes at the camera | Consistent character styling |
| Cat character + jacket + sunglasses | A standing cat character wearing a jacket and sunglasses strikes a pose towards the camera on the stage | Character with accessories |
| Dog + Chinese winter coat | A white Bichon Frisé wearing a red floral Chinese-style winter coat licks its lips | Pet with costume |
| Elderly man cartoon | In a café, a cartoon-style elderly man lifts a cup to drink coffee | Animated character |

#### Use Case 2: Character Interactions

Upload images of multiple subjects and describe their interactions.

| Elements | Prompt | Result Description |
|----------|--------|-------------------|
| Two girls | Two girls hug each other | Character interaction |
| Boy + Pegasus | A boy rides a Pegasus, soaring through the air, in a magical world | Fantasy scene |
| Cartoon character + bear | A cartoon character wearing a white hat, and a cartoon-style bear, sitting side by side, wave and nudge at each other | Multiple character interaction |

---

### Extend with Prompts

AI-generated videos can be extended by 4-5 seconds with multiple continuations, reaching a total length of up to **3 minutes**.

#### Extension Modes

- **Auto-Extend** - No prompt needed; the model autonomously continues based on the video content
- **Customized Extend** - Users dictate the continuation via text input

#### The Prompt Formula

💡 **Prompt = Subject + Movement**

| Component | Description |
|-----------|-------------|
| **Subject** | The subject you wish to animate; choose one main subject for better results |
| **Movement** | Descriptions of the subject's movement status |

#### Example Extension Sequence

| Step | Prompt |
|------|--------|
| Original Video | (Starting content) |
| Extend x1 | A woman is standing in the snow, raising her right hand to touch the brim of her hat |
| Extend x2 | The woman lowers her hand and looks into the distance |

#### High-Quality Extension Examples

- **Mushroom to Penguins:** "The mushrooms in the plate transform into a group of penguins that walk in the snow" (Standard Mode)
- **Puppies from Box:** "Numerous puppies crawling out from the box" (Standard Mode)
- **Kitten in Snow:** "Kitten walking into the snow" (Standard Mode)
- **Car Racing:** "First-person perspective, in a car race, holding the steering wheel of a sports car, accelerating on the highway" (Standard Mode)

#### Tips for Extending

- When using "Customized Extend," the prompt needs to be consistent with the main subject of the original video
- Unrelated text may cause a camera cut or transition
- The extending process has a certain degree of probability; multiple attempts may be required

---

## 2. Advanced Functions

### Standard Mode & Professional Mode

| Mode | Characteristics |
|------|-----------------|
| **Standard Mode** | Faster generation, lower inference costs. Excels in creating portraits, animals, and scenes with significant motion. Animals appear more amiable with soft, pleasing color grading. |
| **Professional Mode** | Higher quality with richer details. Excels in portraits, animals, architecture, and landscapes with more sophisticated composition and color atmosphere. Best for intricate video production. |

#### Comparison Examples

| Prompt | Standard Mode | Professional Mode |
|--------|---------------|-------------------|
| A panda is playing guitar by the river | 🌟🌟🌟🌟 Natural movement, soft color tones | 🌟🌟🌟🌟 Richer guitar details, enhanced imagination, stable camera |
| A medieval sailing ship navigating the sea on a foggy night | 🌟🌟🌟 Natural motion, less pronounced details | 🌟🌟🌟🌟🌟 Rich details, physics-conforming sails, cinematic quality |

---

### Camera Movement

Camera movement control supports six basic movements and four Master Shots:

#### Basic Movements
- Horizontal
- Vertical
- Zoom
- Pan
- Tilt
- Roll

#### Master Shots
- Move Left and Zoom In
- Move Right and Zoom In
- Move Forward and Zoom Up
- Move Down and Zoom Out

---

### Start and End Frames

Upload two images as starting and ending frames to generate a transition video. Access this feature by clicking "Add End Frame" in the "Image to Video" function.

#### Tips for Start and End Frames

- Choose two similar images with the same theme for smoother transitions within 5 seconds
- Large differences may trigger a shot switch
- Many users generate similar images through AI image generation, then use this function for video creation

---

### Motion Brush

By uploading an image, users can designate an area or element using "automatic selection" or "manual brushing" and add a motion trajectory. This allows control over specific element motions.

#### Features
- Control motion of specific elements
- Generate complex motions like "ball games"
- Handle movement and direction changes of people/animals
- Support up to six elements and their trajectories simultaneously
- **Static Brush** - Designate static areas to fix pixels and prevent camera movement

#### Example Prompts with Motion Brush

| Text Prompt | Motion Application | Mode |
|-------------|-------------------|------|
| A sailboat moves slowly on the sea, creating ripples | Sailboat trajectory | Standard/Professional |
| The grass sways in the wind, while two dogs look off in different directions | Grass + dogs trajectories | Standard/Professional |
| An apple falls in the water | Apple trajectory | Standard/Professional |

#### Important Tips for Motion Brush

1. **Always add a matching text prompt** - Use prompts like "a puppy running on the road" following the "element + motion" format

2. **Select key parts only** - Selecting only key parts of an object (such as an animal's head) allows for more precise motion control

3. **Physical world constraints** - Designating a motion trajectory for objects that cannot move in the physical world (like buildings) will be interpreted as camera movement

4. **Use Static Brush to avoid camera movement** - After brushing, pixels will be fixed in the brushed areas

5. **Brushing Area Selection Tips:**
   - One motion brush should cover only one element of a single category ✅
   - One motion brush should cover one connected area rather than multiple separate areas ✅
   - A static brush can cover multiple non-connected areas, but each independent selected area should ideally be of the same category

6. **Motion Trajectory Tips:**
   - The direction and length of the trajectory curve both have an effect
   - If the starting point is within the selected area, the endpoint indicates the element's position at the end of the video
   - The element's movement will strictly follow the drawn trajectory

---

### Lip Sync

The "Lip Sync" feature synchronizes character lip movements with audio, making characters appear as if they're really speaking or singing.

#### How to Use

1. Generate a video featuring a character with a complete face in Kling AI
2. Click on "Lip Sync" and preview the effect
3. In the popup:
   - Click "Text to Speech" to generate a voiceover, OR
   - Upload a local voiceover/singing file
4. AI-generated voices support speed adjustments (0.8x to 2x)
5. Click "Lip Sync" and wait a few minutes for synchronization

#### Pricing
- 5-second video: 5 inspiration credits
- 10-second video: 10 inspiration credits
- Audio exceeding video length can be cropped

#### Tips for Lip Sync

- Available for videos generated in Kling 1.0 and Kling 1.5 (character's face must be complete)
- Available for human characters (real/3D/2D)
- Not available for animal characters

---

## 3. Scenario Applications

### Text-to-Video Scenes

| Scene Type | Description |
|------------|-------------|
| Short Commercial | Product showcases, brand videos |
| Creative | Artistic and imaginative content |
| Sci-Fi | Space, futuristic, technology themes |
| Oriental Character | Chinese/Asian cultural themes |
| Ancient Style | Historical, traditional aesthetics |
| Fantasy | Magical, mythical content |
| Martial Arts | Action, combat sequences |

### Image-to-Video Scenes

| Scene Type | Description |
|------------|-------------|
| Live Photo | Bringing still photos to life |
| Ink Style | Traditional ink painting animation |
| Brand | Logo and brand identity animation |

---

## Contact & Community

📧 **Contact us:** kling@kuaishou.com

**Follow us:**
- Twitter
- YouTube
- Facebook

**Join the Community:** Scan QR with WeChat to join Kling's official group.

**Subscribe to Kling AI** for more introduction and idea sharing!

---

*Dear users of Kling AI, thank you for choosing Kling! This guide will be continuously updated as the model iterates. If you find any better tricks for the model, please contact us at kling@kuaishou.com. After being adopted, we will have additional Credits!*
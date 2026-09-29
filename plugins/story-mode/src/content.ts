/** Runtime teaching text from the current bilingual chapter requirements. */
export const chapter = {
  "en": {
    "title": "Chapter 1: Your First Character",
    "sections": [
      {
        "steps": [
          {
            "operation": "Read the teaching text, followed by the written example and analysis.",
            "result": "The right panel presents the complete explanation before the input and reply; the save's content remains blank."
          },
          {
            "operation": "Continue manually.",
            "result": "Persist this section's advancement, enter 1.2 and make opening editing available."
          }
        ],
        "title": "1.1 Prompts and Replies",
        "teaching": [
          "A language model generates text from the input it receives. That input can include task instructions, background information and examples of expression. Content supplied to guide generation is commonly called a prompt. The information in a prompt influences what a reply addresses, how it is expressed and which requirements it needs to satisfy.",
          "The relationship between input and reply can be understood through the uses of that information. Task instructions describe the intended work, background information supplies material needed for it, and examples demonstrate a possible form of expression. A prompt can contain all of these, which together influence the generated result.",
          "In character performance, a prompt can establish a person's identity, situation and purpose in the exchange. Character details guide behavior and expression, situational information establishes the setting, and the current input supplies something to respond to. Together, these shape how the character participates.",
          "Authoring can begin with the intended focus of the exchange and the information the model would need. Background that directly affects the interaction, a clear conversational purpose and representative examples of expression can all contribute useful material to a prompt."
        ],
        "examples": [
          {
            "role": "Input",
            "text": "Dusk settles over the harbor. I reach the lighthouse door with a damp map."
          },
          {
            "role": "Response",
            "text": "The keeper opens the door a little. “Come inside. What brought you out in this fog?”"
          }
        ],
        "analysis": [
          "The input establishes the harbor, the map and the visitor's arrival. The reply responds by opening the door, offering an invitation and asking a question. Background and action give the exchange a direction from which further interaction can develop."
        ],
        "guidance": [
          "Select Continue to learn about messages and context."
        ],
        "hint": "Select Continue to learn about messages and context.",
        "states": []
      },
      {
        "steps": [
          {
            "operation": "Read the teaching text, then the opening example with role labels.",
            "result": "The right panel explains messages and context before showing roles and order; the opening editor is available in the center."
          },
          {
            "operation": "Add or edit messages, change roles and order, or leave the list empty.",
            "result": "Each message shows a role control, body editing, highlighting and save state."
          },
          {
            "operation": "Save the current opening settings and continue.",
            "result": "Persist this section's completion, enter 1.3 and make system-prompt editing available."
          }
        ],
        "title": "1.2 Messages and Context",
        "teaching": [
          "Conversation applications organize exchanges as ordered messages. Each message has a body and a role label. The user role usually carries input from the user's side, while the assistant role usually carries the model's response. Role labels and message order together establish each passage's place in the exchange.",
          "After a reply is generated, an application can supply the preceding messages alongside a new input. The input available for a particular generation forms its context. Earlier messages can supply information already mentioned, the sequence of events and an ongoing topic, connecting a new reply to the preceding exchange.",
          "Opening messages use this mechanism to arrange an initial exchange in advance. In a Playbook, the creator writes these messages, which enter the performance with their saved roles and order. An assistant opening can demonstrate a response, while a user opening can establish a situation or purpose. An actual model reply is produced when a new request in the performance completes.",
          "In character performance, user-side messages can present the player's actions, questions and additional background. Assistant-side messages can present character dialogue and scene descriptions. Connected messages can also demonstrate the intended narrative rhythm. Message roles describe the function of content in the conversation, while the text conveys the identities of the fictional participants.",
          "An opening can be arranged around the space intended for further interaction. A fuller opening can supply more situational and relational background, a brief opening can hand the exchange to the player sooner, and an empty opening can leave the first words to the player. Roles, bodies and order can work together to support these choices."
        ],
        "examples": [
          {
            "role": "user",
            "text": "Dusk settles over the harbor. I reach the lighthouse door with a damp map."
          },
          {
            "role": "assistant",
            "text": "The keeper opens the door a little. “Come inside. What brought you out in this fog?”"
          }
        ],
        "analysis": [
          "The user message establishes the visitor's action, and the assistant message supplies the keeper's response. Together, they form a scene that later exchanges can build on. The identities in the text convey the story's participants, while the user and assistant roles establish their messages' positions in the conversation."
        ],
        "guidance": [
          "Write the opening, adjust its roles and order, then save and continue. You can also save an empty opening.",
          "No opening messages. You can add one or keep the opening empty."
        ],
        "hint": "Write the opening, adjust its roles and order, then save and continue. You can also save an empty opening.",
        "states": []
      },
      {
        "steps": [
          {
            "operation": "Read the teaching text, then the complete example with system instructions.",
            "result": "The right panel explains how overall instructions relate to a particular exchange, followed by the example."
          },
          {
            "operation": "Write the system prompt manually or ask a writer to help.",
            "result": "The system-prompt editor becomes available in the center while opening editing remains accessible."
          },
          {
            "operation": "Save a nonblank system prompt and continue.",
            "result": "Persist this section's completion and enter 1.4."
          }
        ],
        "title": "1.3 System Prompts and Character Design",
        "teaching": [
          "A system prompt supplies task and behavioral instructions that apply across an exchange. This content is usually passed through the system role or the corresponding location provided by the model's interface. Together with user and assistant messages, it forms the context used for generation.",
          "The conventional functions of the three roles can now be considered together: the system role describes the overall task and behavioral instructions, the user role supplies the current input to address, and the assistant role presents the model's side of the exchange. The model interprets these contents and their relationships according to the instruction priorities and processing conventions of the model and interface in use.",
          "In character performance, a system prompt can hold relatively stable character details, such as identity, experience, motivation, knowledge, relationships and expressive style. It can also establish which characters the model portrays and which narrative perspective it uses. Particular events and developments can then enter the context through messages as the exchange progresses.",
          "Character details can be organized around how a person understands a situation, makes choices and expresses themselves. Traits with greater influence on interaction may benefit from fuller treatment, while background details can develop through further authoring. Coherent details can help a model apply the character's traits across different situations."
        ],
        "examples": [
          {
            "role": "system",
            "text": "You portray a lighthouse keeper who lives beside a foggy harbor. Speak in short, calm sentences and describe what you can see and hear. When the visitor asks about something you do not know, say so and ask what they have discovered."
          },
          {
            "role": "user",
            "text": "Dusk settles over the harbor. I reach the lighthouse door with a damp map."
          },
          {
            "role": "assistant",
            "text": "The keeper opens the door a little. “Come inside. What brought you out in this fog?”"
          }
        ],
        "analysis": [
          "The system instructions establish the keeper's identity, manner of speaking and approach to unfamiliar information. The user message describes the visitor's arrival, and the assistant message responds by opening the door and asking a question. Character details and the current situation together provide a basis for the exchange."
        ],
        "guidance": [
          "Describe the character and their behavioral instructions, then save and continue. You can write them yourself or ask a writer for help."
        ],
        "hint": "Describe the character and their behavioral instructions, then save and continue. You can write them yourself or ask a writer for help.",
        "states": [
          "Save a system prompt containing some text before continuing."
        ]
      },
      {
        "steps": [
          {
            "operation": "Read the teaching text, then compare several arrangements of the same character details.",
            "result": "The right panel explains roles and placement before showing examples and analysis; both editors remain available."
          },
          {
            "operation": "Choose a preferred configured model and optionally change the content arrangement.",
            "result": "Native model controls show the current choice, with native configuration available when needed."
          },
          {
            "operation": "Resolve pending edits and continue manually.",
            "result": "A valid model choice permits entry to 1.5, including with the existing content."
          }
        ],
        "title": "1.4 Content Placement and Model Differences",
        "teaching": [
          "Message roles give content different positions in an exchange. The same passage establishes a different conversational relationship when it enters the context as a system instruction, content supplied by the user, or something the assistant has already said. The content, its role label and its position can all influence the model's next reply.",
          "Models differ in the conversation formats they encountered during training, their instruction training and their generation habits. They can therefore respond differently to the same content arrangement. Some arrangements may help a particular model sustain character details, while others may better support the continuation of a voice or narrative style.",
          "In character performance, content placement can extend beyond the three roles' conventional functions. Ongoing character instructions can appear in a user message alongside a particular situation. Behavioral conventions can also be written as the character's own statements in assistant history, giving later generation an expression to continue from. For a particular model, these arrangements may produce results closer to the creative intent than conventional placement.",
          "Content placement can be considered in terms of both the purpose of the instructions and the actual reply. Consistency of identity and motivation, responsiveness to the situation and the intended language style can all inform that assessment. Comparing arrangements of the same character details and observing several exchanges can help establish an approach suited to the current model and character."
        ],
        "examples": [
          {
            "role": "system",
            "text": "You portray a lighthouse keeper who lives beside a foggy harbor. Speak in short, calm sentences and describe what you can see and hear. When the visitor asks about something you do not know, say so and ask what they have discovered."
          },
          {
            "role": "user",
            "text": "You portray a lighthouse keeper who lives beside a foggy harbor. Speak in short, calm sentences and describe what you can see and hear. When the visitor asks about something you do not know, say so and ask what they have discovered."
          },
          {
            "role": "assistant",
            "text": "I live beside a foggy harbor and tend its lighthouse. I speak in short, calm sentences and pay attention to what I can see and hear. When I do not know something, I say so and ask visitors what they have discovered."
          }
        ],
        "analysis": [
          "The first arrangement supplies the character details as overall instructions, the second places the same words in a user message, and the third presents identity and behavior as something the character has already said. The first two can help reveal the effect of role placement; the third also changes the perspective of the writing. Their effects can be assessed through the character behavior and language later produced by the selected model. Basic task instructions can remain in the system prompt while other details are placed according to the observed performance."
        ],
        "guidance": [
          "Choose a configured model, then continue."
        ],
        "hint": "Choose a configured model, then continue.",
        "states": [
          "Choose a configured model before continuing."
        ]
      },
      {
        "steps": [
          {
            "operation": "Read the teaching text, then the first-input example.",
            "result": "The right panel explains reasoning investment and observation criteria before presenting the example and analysis."
          },
          {
            "operation": "Choose supported reasoning effort and adjust the model selection if needed.",
            "result": "Native controls show the effective choice while global defaults remain unchanged."
          },
          {
            "operation": "Resolve pending edits and start the performance.",
            "result": "Freeze saved content and display its opening on the native conversation page, awaiting the first input."
          },
          {
            "operation": "Send a message and wait for a successful complete reply.",
            "result": "Persist the qualifying record and submit the chapter; after success, show continuation choices."
          }
        ],
        "title": "1.5 Reasoning Effort and the First Performance",
        "teaching": [
          "Reasoning effort adjusts how much reasoning some models invest in generating a reply. Reasoning can support the analysis of instructions, integration of background information and organization of an answer. Models that support this setting provide corresponding options whose effects depend on the model.",
          "Reasoning investment affects generation and may change reply quality, response time and usage. In character performance, extensive background, complex relationships and connected reasoning may increase the need to integrate information. A brisk exchange may place greater emphasis on waiting time. A suitable setting can reflect both the interaction and the user's preferences.",
          "A performance brings the authored character details, opening messages and new input together for generation. It provides an opportunity to observe how the model applies the character details, responds to the situation and forms an expression. Several exchanges in similar situations can inform model choice, content placement and reasoning effort.",
          "Observation of a first character can begin with continuity, responsiveness to the situation and expressive style. As the exchange develops, it becomes easier to identify which details influence the character's choices and which expressions match the intended effect. These observations can also inform further authoring."
        ],
        "examples": [
          {
            "role": "user",
            "text": "I spread the map on the table. Have you seen this mark before?"
          }
        ],
        "analysis": [
          "The question about the map follows from the visitor carrying it in the opening and gives the keeper something to address. Whether the reply retains the brief, calm style, and how it handles an unfamiliar mark, can help reveal the effect of the character instructions in a particular exchange."
        ],
        "guidance": [
          "This model and reasoning effort selection applies to the current performance. At startup, the system fixes the saved system prompt and opening messages, then displays the opening; an empty opening waits for the first input. Further edits remain in the Playbook while the current performance retains its starting content.",
          "After the first successful complete model text reply, the system saves this chapter's submission revision. A successful save completes Your First Character and retains the current conversation. If chapter saving fails, it can be retried using the same successful reply."
        ],
        "hint": "This model and reasoning effort selection applies to the current performance. At startup, the system fixes the saved system prompt and opening messages, then displays the opening; an empty opening waits for the first input. Further edits remain in the Playbook while the current performance retains its starting content.",
        "states": [
          "Choose a configured model.",
          "Choose a reasoning effort setting supported by the model.",
          "Save your system prompt and opening settings, then start the performance.",
          "Send a message to your character to begin the first real exchange.",
          "This model has no adjustable reasoning effort setting. You can still use it.",
          "Send a message to your character and wait for the first complete reply.",
          "The reply did not complete. You can try again; reopening this page will not resend your message.",
          "The reply succeeded, but the chapter was not saved. Retry saving without sending another message.",
          "Retry chapter save",
          "You have completed Your First Character. You can keep chatting or enter Chapter 2 when it is available."
        ]
      }
    ]
  },
  "zh": {
    "title": "第一章：第一个角色",
    "sections": [
      {
        "steps": [
          {
            "operation": "阅读讲解，再查看书面示例及分析。",
            "result": "右侧先呈现完整讲解，再展示输入与回应；存档内容保持空白。"
          },
          {
            "operation": "手动继续。",
            "result": "保存本节推进状态，进入 1.2 并开放开场编辑。"
          }
        ],
        "title": "1.1 提示词与回复",
        "teaching": [
          "语言模型（language model）根据收到的输入生成后续文本。输入可以包含任务要求、背景资料和表达示例，这些用于引导生成的内容通常称为提示词（prompt）。提示词提供的信息，会影响回复围绕什么展开、采用怎样的表达，以及需要满足哪些要求。",
          "输入与回复之间的联系，可以从信息的使用方式理解。任务要求说明希望模型完成什么，背景资料提供处理任务所需的信息，示例则展示一种可以参考的表达方式。一份提示词可以同时包含这些内容，它们共同影响生成结果。",
          "在角色演绎中，提示词可以提供人物身份、所处情景和交流目的。人物设定为行为与表达提供依据，情景信息建立交流发生的背景，当前输入则提供需要回应的内容。这些信息共同影响角色如何参与交流。",
          "创作时，可以先考虑希望这次交流围绕什么展开，以及模型需要了解哪些信息。对互动有直接影响的背景、明确的交流意图和具有代表性的表达示例，通常都能为提示词提供有用的内容。"
        ],
        "examples": [
          {
            "role": "输入",
            "text": "暮色落在港口。我拿着一张潮湿的地图，走到灯塔门前。"
          },
          {
            "role": "回应",
            "text": "守灯人将门推开一道缝：“先进来吧。是什么事让你在这种雾里赶路？”"
          }
        ],
        "analysis": [
          "输入交代港口、地图和来访行动，回应通过开门、邀请和询问接住这些信息。背景与行动为交流提供了方向，回应由此展开新的互动。"
        ],
        "guidance": [
          "点击“继续”，了解消息与上下文。"
        ],
        "hint": "点击“继续”，了解消息与上下文。",
        "states": []
      },
      {
        "steps": [
          {
            "operation": "阅读讲解，再查看带角色标记的开场示例。",
            "result": "右侧解释消息与上下文，随后展示角色和顺序；中央开放开场编辑器。"
          },
          {
            "operation": "新增或编辑消息、修改角色和顺序，也可以保持空列表。",
            "result": "每条消息显示角色控件、正文编辑、高亮和保存状态。"
          },
          {
            "operation": "保存当前开场设置并继续。",
            "result": "保存本节完成状态，进入 1.3 并开放系统提示词编辑。"
          }
        ],
        "title": "1.2 消息与上下文",
        "teaching": [
          "对话应用将交流组织为按顺序排列的消息（message）。每条消息包含正文和角色标记。用户角色（user）通常承载用户一侧的输入，助手角色（assistant）通常承载模型一侧的回应。角色标记和消息顺序共同说明内容在交流中的位置。",
          "一次回复生成后，应用可以把此前的消息与新的输入一起提供给模型。本次生成能够参考的输入内容构成上下文（context）。已有消息可以提供人物提到过的信息、事件的先后关系和正在延续的话题，使新的回复与此前交流建立联系。",
          "开场白利用这一机制，为交流预先安排一组消息。在 Playbook 中，开场消息由创作者编写，按保存的角色和顺序进入演绎。助手角色的开场可以提供回应示例，用户角色的开场可以交代情景或来意；实际模型回复在演绎中的新请求完成后产生。",
          "在角色演绎中，用户侧的消息适合呈现玩家的行动、问题和补充背景，助手侧的消息适合呈现角色台词与场景描写。一组相互衔接的消息，也可以展示预期的叙述节奏。消息角色描述内容在对话中的职责，故事人物的身份则通过正文表达。",
          "开场的安排可以结合希望保留的互动空间选择。较完整的开场能提供更多情景和关系背景，简短开场能较早把交流交给玩家，空开场则适合由玩家决定第一句话。消息的角色、正文和顺序可以共同服务于这些选择。"
        ],
        "examples": [
          {
            "role": "user",
            "text": "暮色落在港口。我拿着一张潮湿的地图，走到灯塔门前。"
          },
          {
            "role": "assistant",
            "text": "守灯人将门推开一道缝：“先进来吧。是什么事让你在这种雾里赶路？”"
          }
        ],
        "analysis": [
          "用户消息交代来访者的行动，助手消息安排守灯人的回应。两条消息连在一起，形成后来交流可以承接的场景。正文中的人物身份与消息的用户、助手角色分别表达故事内容和对话位置。"
        ],
        "guidance": [
          "编写开场，调整角色和顺序，保存后继续。你也可以保存空开场。",
          "暂无开场消息。你可以添加消息，也可以保持空开场。"
        ],
        "hint": "编写开场，调整角色和顺序，保存后继续。你也可以保存空开场。",
        "states": []
      },
      {
        "steps": [
          {
            "operation": "阅读讲解，再查看带有系统要求的完整示例。",
            "result": "右侧说明整体要求与具体交流的关系，示例在讲解之后展示。"
          },
          {
            "operation": "手动编写系统提示词，或请编剧协助。",
            "result": "中央开放系统提示词编辑器，保留开场编辑能力。"
          },
          {
            "operation": "保存非空白系统提示词并继续。",
            "result": "保存本节完成状态，进入 1.4。"
          }
        ],
        "title": "1.3 系统提示词与角色设定",
        "teaching": [
          "系统提示词（system prompt）为模型提供适用于整体交流的任务和行为要求。这类内容通常通过系统角色（system）或模型接口提供的对应位置传入，与用户（user）消息、助手（assistant）消息共同构成生成所依据的上下文。",
          "三种消息角色的常规职责可以由此联系起来理解：系统角色说明整体任务和行为要求，用户角色提供当前需要处理的输入，助手角色呈现模型一侧的回应。模型会结合这些内容及其前后关系理解交流，具体的指令优先级和处理方式由所用模型及接口约定。",
          "在角色演绎中，系统提示词适合容纳较稳定的角色设定，例如身份、经历、动机、知识范围、人物关系和表达风格。模型负责扮演哪些人物、采用什么叙述视角，也可以在这里约定。具体事件和交流进展则可以随着消息逐步加入上下文。",
          "角色设定可以围绕人物如何理解处境、作出选择和表达自己来组织。影响互动较大的特点适合得到更充分的描述，背景细节可以随着创作逐步丰富。相互协调的设定，有助于模型将角色特点运用到不同情景中。"
        ],
        "examples": [
          {
            "role": "system",
            "text": "你扮演住在雾港边的守灯人。说话简短、平静，描述你能看见和听见的事物。访客问起你不了解的事情时，坦诚说明，并问问对方发现了什么。"
          },
          {
            "role": "user",
            "text": "暮色落在港口。我拿着一张潮湿的地图，走到灯塔门前。"
          },
          {
            "role": "assistant",
            "text": "守灯人将门推开一道缝：“先进来吧。是什么事让你在这种雾里赶路？”"
          }
        ],
        "analysis": [
          "系统要求约定守灯人的身份、说话方式和面对未知信息的态度。用户消息交代来访行动，助手消息给出开门与询问的回应。角色设定与当前情景共同构成交流的依据。"
        ],
        "guidance": [
          "描述角色的设定与行为要求，保存后继续。你可以自己编写，也可以请编剧协助。"
        ],
        "hint": "描述角色的设定与行为要求，保存后继续。你可以自己编写，也可以请编剧协助。",
        "states": [
          "请先保存包含文字的系统提示词，再继续。"
        ]
      },
      {
        "steps": [
          {
            "operation": "阅读讲解，再比较同一设定的几种安排。",
            "result": "右侧先说明角色与位置的作用，再展示示例及分析；两个编辑器保持可用。"
          },
          {
            "operation": "选择喜欢的已配置模型，可以自行调整内容安排。",
            "result": "原生模型控件显示当前选择，需要时进入原生配置。"
          },
          {
            "operation": "处理待保存修改并手动继续。",
            "result": "有效模型选择允许进入 1.5，原有内容同样可以继续。"
          }
        ],
        "title": "1.4 内容安排与模型差异",
        "teaching": [
          "消息角色为内容提供了不同的使用位置。同一段文字作为系统（system）要求、用户（user）提出的内容或助手（assistant）已经说过的话进入上下文时，会形成不同的对话关系。内容本身、角色标记和排列位置，都可能影响模型接下来的回应。",
          "不同模型在训练中接触的对话形式、接受的指令训练及生成习惯有所差异，因此对同一种内容安排可能产生不同反应。有些安排更容易使某个模型持续遵循角色设定，另一些安排则可能更有利于延续语气或叙述方式。",
          "在角色演绎中，内容安排可以超出三种角色的常规分工。持续适用的角色要求可以放进用户消息，与具体情景一起呈现；行为约定也可以写成助手历史中的角色自述，让后续生成沿着这段表达继续。对特定模型，这些放法可能比常规安排产生更符合创作意图的效果。",
          "选择内容位置时，可以同时考虑要求的用途和实际回应。角色是否保持身份与动机，是否回应当前情景，语言是否符合预期，都能提供判断依据。围绕相同设定比较不同安排，并观察多次交流，有助于形成适合当前模型与角色的用法。"
        ],
        "examples": [
          {
            "role": "system",
            "text": "你扮演住在雾港边的守灯人。说话简短、平静，描述你能看见和听见的事物。访客问起你不了解的事情时，坦诚说明，并问问对方发现了什么。"
          },
          {
            "role": "user",
            "text": "你扮演住在雾港边的守灯人。说话简短、平静，描述你能看见和听见的事物。访客问起你不了解的事情时，坦诚说明，并问问对方发现了什么。"
          },
          {
            "role": "assistant",
            "text": "我住在雾港边，守着这里的灯塔。我说话简短、平静，留意眼前看见和听见的事物。遇到不了解的事情，我会坦诚说明，并向访客询问他们的发现。"
          }
        ],
        "analysis": [
          "第一种安排将设定作为整体要求提供，第二种将相同文字放入用户消息，第三种则把身份与行为写成角色已经说过的话。前两种可以用来观察角色位置的影响，第三种还改变了表达视角。不同安排的效果，可以结合所选模型后续呈现的角色行为与语言来判断。基本任务要求可以保留在系统提示词中，其他设定则可以根据演绎表现调整位置。"
        ],
        "guidance": [
          "选择一个已配置的模型，然后继续。"
        ],
        "hint": "选择一个已配置的模型，然后继续。",
        "states": [
          "请先选择一个已配置的模型，再继续。"
        ]
      },
      {
        "steps": [
          {
            "operation": "阅读讲解，再查看首次输入示例。",
            "result": "右侧先解释推理投入与观察依据，再展示示例及分析。"
          },
          {
            "operation": "选择模型支持的思考强度，需要时调整模型选择。",
            "result": "原生控件显示生效选择，全局默认值保持原样。"
          },
          {
            "operation": "处理待保存修改并启动演绎。",
            "result": "冻结已保存内容，在原生对话页展示开场，等待首次输入。"
          },
          {
            "operation": "发送消息，等待成功收到完整回复。",
            "result": "保存合格记录并提交章节，成功后显示后续选择。"
          }
        ],
        "title": "1.5 思考强度与第一次演绎",
        "teaching": [
          "思考强度（reasoning effort）用于调整部分模型生成回复时投入的推理程度。推理可以用于分析要求、整合背景和组织回答。支持这一设置的模型会提供相应选项，各选项的实际作用与模型有关。",
          "推理投入会影响生成过程，也可能改变回复表现、响应时间和用量。在角色演绎中，较多背景、复杂人物关系和连续推理可能增加信息整合的需要；节奏紧凑的交流则往往更重视等待时间。适合的档位可以结合互动内容和使用偏好选择。",
          "实际演绎将此前安排的角色设定、开场消息和新的输入共同用于生成。由此可以观察，模型如何运用设定、承接情景，以及形成具体表达。相近情景下的多次交流，能够为模型选择、内容安排和思考强度提供参照。",
          "对第一个角色的观察可以从连贯程度、情景回应和表达风格开始。随着交流展开，哪些设定影响了角色的选择、哪些表达符合预期，会逐渐变得具体。这些观察也可以成为后续创作的依据。"
        ],
        "examples": [
          {
            "role": "user",
            "text": "我把地图摊在桌上。你以前见过这个标记吗？"
          }
        ],
        "analysis": [
          "地图提问承接来访者携带地图的开场，并给守灯人一个需要回应的问题。回应是否延续简短、平静的表达，以及如何处理不熟悉的标记，可以帮助观察角色设定在具体交流中的作用。"
        ],
        "guidance": [
          "本次模型与思考强度选择用于当前演绎。启动时，系统固定使用已保存的系统提示词和开场消息，先展示开场内容；空开场等待第一条输入。后续修改继续保存在 Playbook 中，当前演绎保留启动时的内容。",
          "首次成功收到完整模型正文回复后，系统保存本章提交版本。保存成功时完成“第一个角色”，当前对话继续保留。章节保存失败时，可以重试保存，系统会使用同一次成功回复完成提交。"
        ],
        "hint": "本次模型与思考强度选择用于当前演绎。启动时，系统固定使用已保存的系统提示词和开场消息，先展示开场内容；空开场等待第一条输入。后续修改继续保存在 Playbook 中，当前演绎保留启动时的内容。",
        "states": [
          "选择一个已配置的模型。",
          "在模型支持的选项中选择思考强度。",
          "保存系统提示词和开场设置，然后启动演绎。",
          "向角色发送一条消息，开始第一次真实交流。",
          "当前模型没有可调节的思考强度设置，仍可使用。",
          "向你的角色发送消息，等待第一条完整回复。",
          "回复未完成，可以重试。重新打开页面不会自动发送你的消息。",
          "回复已成功，但章节尚未保存。请重试保存，无需再次发送消息。",
          "重试保存章节",
          "你已完成“第一个角色”。可以继续对话，或在第二章开放后进入。"
        ]
      }
    ]
  }
} as const

def history_to_messages(history):
    messages = []
    if history:
        starting_role = "assistant" if len(history) % 2 == 0 else "user"
        for i, msg in enumerate(history):
            role = "user" if (i % 2 == 0) == (starting_role == "user") else "assistant"
            content = f"{msg.author}: {msg.content}" if msg.author else msg.content
            messages.append({"role": role, "content": content})
    else:
        messages.append({"role": "user", "content": "An empty placeholder image"})
    return messages

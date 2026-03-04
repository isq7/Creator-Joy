from transformers import pipeline

summarizer = pipeline(
    "summarization",
    model="facebook/bart-large-cnn"
)

text = """In an era where algorithms curate reality, individuals increasingly mistake optimization for truth, confusing engagement metrics with epistemic validity.
As convenience silently reshapes cognition, the boundary between autonomous thought and engineered influence dissolves beneath the illusion of choice."""

summary = summarizer(
    text,
    max_length=40,
    min_length=10,
    do_sample=False
)

print(summary[0]['summary_text'])

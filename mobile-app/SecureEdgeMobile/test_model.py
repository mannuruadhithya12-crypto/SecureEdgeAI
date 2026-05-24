import runpy
import os

script = os.path.join(os.path.dirname(__file__), 'ai-models', 'test', 'test_model.py')
runpy.run_path(script, run_name='__main__')

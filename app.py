from flask import Flask, jsonify, request, render_template
import pandas as pd
import traceback

app = Flask(__name__)

# Dictionnaire pour stocker les réponses de validation
validation_responses = {}

# Dictionnaire pour stocker le résumé des points bloquants
resume_points_bloquants = {}

@app.route('/update_validation_response', methods=['POST'])
def update_validation_response():
    try:
        data = request.json
        validation_id = data['validation_id']
        response = data['response']

        # Mettre à jour la réponse de validation dans le dictionnaire
        validation_responses[validation_id] = response

        # Répondre avec un succès
        return jsonify({'success': True})
    except Exception as e:
        print(f"Erreur lors de la mise à jour de la réponse : {str(e)}")
        return jsonify({'success': False}), 500

# Charger les questions depuis l'Excel
def load_questions():
    try:
        file_path = "ModèleDeQuestionnaires.xlsx"
        xls = pd.ExcelFile(file_path)

        # Charger les questions de qualification et validation
        questions_qualification = pd.read_excel(xls, sheet_name='Questions qualification')
        questions_validation = pd.read_excel(xls, sheet_name='Questions validation')

        qualification_list = []
        validation_list = []

        # Lire les questions de qualification
        for _, row in questions_qualification.iterrows():
            if pd.notna(row['CODES']) and pd.notna(row['Items de Contrôle']):
                qualification_list.append({
                    'id': int(row['CODES']) if pd.notna(row['CODES']) else None,  # Convertir en int si non NaN
                    'question': row['Items de Contrôle'] if pd.notna(row['Items de Contrôle']) else None,
                    'complexite': row['Complexité'] if pd.notna(row['Complexité']) else None,
                    'response': 'no'  # Par défaut, la réponse est non
                })

        # Générer un compteur pour les IDs manquants
        generated_id = len(questions_validation)  # Commencer après le nombre de validations déjà présentes

        # Lire les questions de validation
        for _, row in questions_validation.iterrows():
            # Assigner un ID généré si l'ID n'est pas présent
            validation_id = row['ID QUEST\nV2'] if pd.notna(row['ID QUEST\nV2']) else generated_id
            if pd.isna(row['ID QUEST\nV2']):
                generated_id += 1  # Incrémenter l'ID généré pour la prochaine validation manquante

            if pd.notna(row['Code']) and pd.notna(row['FFA/CPE']):
                validation_list.append({
                    'id': validation_id,  # Utiliser l'ID généré si nécessaire
                    'code': str(row['Code']) if pd.notna(row['Code']) else None,
                    'question': row['FFA/CPE'] if pd.notna(row['FFA/CPE']) else None,
                    'point_bloquant_non': row['Point Bloquant.\nCR a réaliser si coché NON et corriger'] if pd.notna(row['Point Bloquant.\nCR a réaliser si coché NON et corriger']) else None,
                    'point_bloquant_tous_cas': row['Point Bloquant.\nCR a réaliser dans tous les cas'] if pd.notna(row['Point Bloquant.\nCR a réaliser dans tous les cas']) else None,
                    'response': None  # Par défaut, aucune réponse n'est préremplie
                })

        return qualification_list, validation_list
    except Exception as e:
        print("Erreur lors du chargement des questions depuis Excel :")
        print(traceback.format_exc())
        return None, None


# Route principale pour l'affichage du formulaire
@app.route('/')
def index():
    return render_template('index.html')

# Route pour récupérer les questions de validation et qualification
@app.route('/questions', methods=['GET'])
def get_questions():
    qualification, validation = load_questions()
    if qualification is None or validation is None:
        return jsonify({'error': 'Erreur lors du chargement des questions'}), 500
    return jsonify({
        'qualification': qualification,
        'validation': validation
    })

# Route pour gérer la soumission de la réponse à une validation
@app.route('/validation_check/<int:question_id>/<response>', methods=['GET'])
def validation_check(question_id, response):
    validation_needed = False
    blocking_point = False
    validation_question_id = None
    blocking_message = None
    related_questions = []

    if response == 'yes':
        if question_id in [11, 12, 13]:
            validation_needed = True
            validation_question_id = 200
            related_questions = [11, 12, 13]

        if question_id == 13:
            blocking_point = True
            blocking_message = "Point bloquant pour la question : Ce choix entraîne une incompatibilité."

    return jsonify({
        'validation_needed': validation_needed,
        'blocking_point': blocking_point,
        'validation_question_id': validation_question_id,
        'related_questions': related_questions,
        'blocking_message': blocking_message
    })

# Route pour récupérer une question de validation spécifique
@app.route('/get_validation_question/<int:validation_question_id>', methods=['GET'])
def get_validation_question(validation_question_id):
    validation_questions = {
        200: "Avez-vous chiffré les prestations liées ?"
    }
    question = validation_questions.get(validation_question_id, "Question non trouvée")
    return jsonify({'question': question})

# Route pour afficher le récapitulatif
@app.route('/recapitulatif', methods=['POST'])
def recapitulatif():
    try:
        responses = request.json
        questions_qualification, questions_validation = load_questions()

        corrections_by_question = {}
        points_bloquants_definitifs = []

        def get_question_text_by_id(question_id):
            question_row = next((q for q in questions_qualification if q['id'] == int(question_id)), None)
            if question_row:
                return question_row['question']
            return f"Question non trouvée pour l'ID : {question_id}"

        # Analyser les réponses et identifier les points bloquants
        for question_id, user_response in responses.items():
            question_text = get_question_text_by_id(question_id)

            # Vérifier si un point bloquant est lié à cette question
            validation = next((v for v in questions_validation if v['id'] == question_id), None)

            if validation:
                # Point bloquant si coché NON
                if validation['point_bloquant_non'] == 'X' and user_response == 'no':
                    resume_points_bloquants[question_id] = validation['question']

                # Point bloquant dans tous les cas
                if validation['point_bloquant_tous_cas'] == 'X':
                    resume_points_bloquants[question_id] = validation['question']

            # Gérer les points bloquants si réponse "yes"
            if user_response == 'yes':
                blocking_check = validation_check(int(question_id), 'yes').json
                if blocking_check['blocking_point']:
                    points_bloquants_definitifs.append({
                        'question_text': question_text,
                        'blocking_message': blocking_check['blocking_message']
                    })

        # Rendre la page récapitulative avec le résumé des points bloquants
        return render_template('recapitulatif.html',
                               points_bloquants_definitifs=points_bloquants_definitifs,
                               corrections_by_question=corrections_by_question,
                               resume_points_bloquants=resume_points_bloquants)
    except Exception as e:
        print("Erreur lors de la génération du récapitulatif :")
        print(traceback.format_exc())
        return jsonify({'error': 'Erreur lors de la génération du récapitulatif'}), 500

if __name__ == '__main__':
    app.run(debug=True)

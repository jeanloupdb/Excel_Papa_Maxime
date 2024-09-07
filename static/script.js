// Dictionnaire global pour stocker les réponses des utilisateurs
let responses = {};
let popupOpen = false; // Flag pour suivre si un popup est déjà ouvert
let pointsBloquantsDefinitifs = [];
let pointsBloquantsSiNon = [];
let pointsValidation = []; // Pour les validations qui ne sont pas des points bloquants

// Charger les questions depuis l'API Flask
fetch('/questions')
    .then(response => response.json())
    .then(data => {
        questionsQualification = data.qualification; // Assigner les questions de qualification globalement
        questionsValidation = data.validation; // Assigner les questions de validation globalement

        // Générer le questionnaire de qualification
        generateQualificationTable(questionsQualification, questionsValidation);
    })
    .catch(error => console.error('Erreur lors du chargement des questions:', error));

// Générer le tableau du formulaire de qualification
function generateQualificationTable(questionsQualification, questionsValidation) {
    const table = document.getElementById('questionsTable');
    
    table.innerHTML = ''; // Vider le tableau avant de le remplir

    // Créer le corps du tableau
    const tbody = document.createElement('tbody');

    // Ajouter l'en-tête avec "Questions", "Oui", et "Non"
    const headerRow = document.createElement('tr');
    const headerQuestionId = document.createElement('th');
    const headerQuestion = document.createElement('th');
    const headerOui = document.createElement('th');
    const headerNon = document.createElement('th');

    headerQuestionId.innerText = 'ID';
    headerQuestion.innerText = 'Questions';
    headerOui.innerText = 'Oui';
    headerNon.innerText = 'Non';

    headerRow.appendChild(headerQuestionId);
    headerRow.appendChild(headerQuestion);
    headerRow.appendChild(headerOui);
    headerRow.appendChild(headerNon);
    tbody.appendChild(headerRow);

    // Créer les lignes pour chaque question de qualification
    questionsQualification.forEach(question => {
        const row = document.createElement('tr');

        // Colonne pour l'ID de la question
        const tdId = document.createElement('td');
        tdId.innerText = question.id; // Affiche l'ID de la question
        row.appendChild(tdId);

        // Colonne pour la question
        const tdQuestion = document.createElement('td');
        tdQuestion.innerText = question.question;
        row.appendChild(tdQuestion);

        // Colonne des options Oui
        const tdOui = document.createElement('td');
        const yesOption = document.createElement('input');
        yesOption.type = 'radio';
        yesOption.name = `question_${question.id}`;
        yesOption.value = 'yes';
        yesOption.id = `yes_${question.id}`;

        // Gérer les changements sur le bouton Oui
        yesOption.addEventListener('change', () => handleYesSelection(question.id, questionsValidation));

        tdOui.appendChild(yesOption);
        row.appendChild(tdOui);

        // Colonne des options Non
        const tdNon = document.createElement('td');
        const noOption = document.createElement('input');
        noOption.type = 'radio';
        noOption.name = `question_${question.id}`;
        noOption.value = 'no';
        noOption.id = `no_${question.id}`;

        if (question.response === 'no') {
            noOption.checked = true;  // Par défaut, "Non" est sélectionné
        }
        else if (question.response === 'yes') {
            yesOption.checked = true;  // Par défaut, "Oui" est sélectionné
        }

        // Gérer les changements sur le bouton Non
        noOption.addEventListener('change', () => handleNoSelection(question.id, questionsValidation));

        tdNon.appendChild(noOption);
        row.appendChild(tdNon);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
}


// Gérer la sélection de "Oui" dans le tableau et ouvrir le popup
function handleYesSelection(questionId, questionsValidation) {
    // Enregistrer la réponse dans le dictionnaire avant d'ouvrir le popup
    responses[questionId] = 'yes';

    // Met à jour le radio button Oui du tableau
    document.querySelector(`input[name="question_${questionId}"][value="yes"]`).checked = true;

    // Récupérer la question de qualification actuelle
    const qualificationQuestion = questionsQualification.find(q => q.id === questionId);

    // Initialiser un tableau pour stocker les questions de validation liées
    let validationsToShow = [];

    // Vérifier si cette question déclenche une validation ou plusieurs
    console.log('Analyse des questions de validation...');
    questionsValidation.forEach(validation => {
        const codes = validation.code.split('+').map(code => code.trim()); // Récupérer les codes multiples

        // Vérifier si le code actuel concerne la question de qualification sélectionnée
        if (codes.includes(String(questionId))) {
            // Vérifier si tous les codes relatifs à cette validation sont cochés "Oui"
            const allCodesYes = codes.every(code => responses[code] === 'yes');
            // Vérifier si la validation a déjà été répondue "Yes" ou "No"
            const validationAlreadyAnswered = responses[`validation_${validation.id}`];

            // Ne pas ajouter les validations déjà répondues et ajouter celles qui nécessitent une validation
            if (allCodesYes && !validationAlreadyAnswered) {
                console.log('Ajout de la validation:', validation);
                validationsToShow.push(validation);
            }
        }
    });

    // Si des validations doivent être montrées, ouvrir un seul popup avec toutes les validations
    if (validationsToShow.length > 0 && !popupOpen) {
        popupOpen = true; // Indique qu'un popup est ouvert
        disableQualificationForm();  // Désactiver le formulaire de qualification
        showPopup(validationsToShow, qualificationQuestion);  // Inclure les validations dans le popup
    }

    // Mettre à jour le résumé des points bloquants
    updatePointsBloquantsSummary();
}


// Gérer la sélection de "Non" dans le tableau et gérer les points bloquants
function handleNoSelection(questionId, questionsValidation) {
    // Enregistrer la réponse dans le dictionnaire
    responses[questionId] = 'no';

    // Met à jour le radio button Non du tableau
    document.querySelector(`input[name="question_${questionId}"][value="no"]`).checked = true;

    // Fermer tout popup existant
    closePopup();

    // supprimer les réponses des validations liées
    questionsValidation.forEach(validation => {
        const codes = validation.code.split('+').map(code => code.trim());

        // Vérifier si cette validation est liée à la question de qualification actuelle
        if (codes.includes(String(questionId))) {
            // Annuler la réponse de validation dans le dictionnaire
            delete responses[`validation_${validation.id}`];

            // Désélectionner l'option dans l'interface utilisateur
            const yesOption = document.querySelector(`input[name="validation_${validation.id}"][value="yes"]`);
            const noOption = document.querySelector(`input[name="validation_${validation.id}"][value="no"]`);

            if (yesOption) yesOption.checked = false;
            if (noOption) noOption.checked = false;

            // Supprimer cette question du tableau des points bloquants
            removePointBloquant(validation.id);
        }
    });

    // Mettre à jour le résumé des points bloquants
    updatePointsBloquantsSummary();
}

// Gérer le clic sur "Je comprends" pour les points bloquants définitifs
function handleComprehension(validationId) {
    responses[`validation_${validationId}`] = 'no'; // Pour un point bloquant définitif, la réponse est marquée comme "no"
    const validationQuestion = questionsValidation.find(v => v.id === validationId);

    if (validationQuestion && validationQuestion.point_bloquant_tous_cas) {
        addPointBloquant(validationId, validationQuestion.question, 'Validation non réussie', 'definitif', validationQuestion.code);
    }

    updatePointsBloquantsSummary();
}


// Gérer les changements sur les réponses de validation dans le popup
function handleValidationChange(validationId, value) {
    responses[`validation_${validationId}`] = value;

    // Mettre à jour l'état dans le tableau principal
    const yesOptionMainTable = document.querySelector(`input[name="validation_${validationId}"][value="yes"]`);
    const noOptionMainTable = document.querySelector(`input[name="validation_${validationId}"][value="no"]`);

    // Cocher la réponse correspondante dans le tableau principal
    if (value === 'yes') {
        if (yesOptionMainTable) yesOptionMainTable.checked = true;
        removePointBloquant(validationId); // Retirer le point bloquant si "Oui"
    } else if (value === 'no') {
        if (noOptionMainTable) noOptionMainTable.checked = true;

        const validationQuestion = questionsValidation.find(v => v.id === validationId);

        if (value === 'no' && validationQuestion.point_bloquant_non) {
            // Passer le code d'activation à `addPointBloquant`
            addPointBloquant(validationId, validationQuestion.question, 'CR à réaliser si coché "Non"', 'si_non', validationQuestion.code);
        } else if (value === 'no') {
            addPointBloquant(validationId, validationQuestion.question, 'Validation non réussie', 'validation', validationQuestion.code);
        }
    }

    updatePointsBloquantsSummary();  // Mettre à jour le résumé des points bloquants
    
    // Envoyer les réponses au serveur Flask
    fetch(`/update_validation_response`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            validation_id: validationId,
            response: value
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Réponse mise à jour avec succès');
        } else {
            console.error('Erreur lors de la mise à jour');
        }
    })
    .catch(error => {
        console.error('Erreur de connexion:', error);
    });
}




// Ajouter un point bloquant dans la bonne catégorie en utilisant l'ID et le code d'activation
function addPointBloquant(validationId, questionText, pointBloquantMessage, type, codeActivation) {
    console.log('validationId:', validationId);
    console.log('questionText:', questionText);
    console.log('pointBloquantMessage:', pointBloquantMessage);
    console.log('type:', type);
    console.log('codeActivation:', codeActivation);


    if (type === 'definitif') {
        if (!pointsBloquantsDefinitifs.some(point => point.id === validationId)) {
            pointsBloquantsDefinitifs.push({
                id: validationId,
                question: questionText,
                message: pointBloquantMessage,
                code: codeActivation // Ajouter le code d'activation
            });
        }
    } else if (type === 'si_non') {
        if (!pointsBloquantsSiNon.some(point => point.id === validationId)) {
            pointsBloquantsSiNon.push({
                id: validationId,
                question: questionText,
                message: pointBloquantMessage,
                code: codeActivation // Ajouter le code d'activation
            });
        }
    } else if (type === 'validation') {
        if (!pointsValidation.some(point => point.id === validationId)) {
            pointsValidation.push({
                id: validationId,
                question: questionText,
                message: pointBloquantMessage,
                code: codeActivation // Ajouter le code d'activation
            });
        }
    }

    updatePointsBloquantsSummary(); // Mettre à jour le résumé immédiatement
}




function updatePointsBloquantsSummary() {
    const pointsBloquantsContainer = document.getElementById('pointsBloquantsContainer');
    pointsBloquantsContainer.innerHTML = ''; // Vider le conteneur avant de le remplir

    // Fonction pour générer un tableau
    function createTable(points, headerTitle) {
        const table = document.createElement('table');
        table.classList.add('resume-table');  // Ajout de la classe pour styliser
        
        const caption = document.createElement('caption');
        caption.innerText = headerTitle;
        table.appendChild(caption);

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Code d'Activation</th>
                <th>Question</th>
                <th>Message</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        points.forEach(point => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${point.code}</td>
                <td>${point.question}</td>
                <td>${point.message}</td>
            `;
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        return table;
    }

    // Générer les tableaux de points bloquants
    if (pointsBloquantsDefinitifs.length > 0) {
        const tableDefinitifs = createTable(pointsBloquantsDefinitifs, 'Points Bloquants Définitifs');
        pointsBloquantsContainer.appendChild(tableDefinitifs);
    }

    if (pointsBloquantsSiNon.length > 0) {
        const tableSiNon = createTable(pointsBloquantsSiNon, 'Points Bloquants Si Coché "Non"');
        pointsBloquantsContainer.appendChild(tableSiNon);
    }

    if (pointsValidation.length > 0) {
        const tableValidation = createTable(pointsValidation, 'Validations simples');
        pointsBloquantsContainer.appendChild(tableValidation);
    }
}



// Fonction pour retirer un point bloquant du résumé des points bloquants basé sur l'ID
function removePointBloquant(validationId) {
    pointsBloquantsDefinitifs = pointsBloquantsDefinitifs.filter(point => point.id !== validationId);
    pointsBloquantsSiNon = pointsBloquantsSiNon.filter(point => point.id !== validationId);
    pointsValidation = pointsValidation.filter(point => point.id !== validationId);

    updatePointsBloquantsSummary(); // Mettre à jour l'affichage du résumé
}


function showPopup(validations, qualificationQuestion) {
    // Créer l'overlay sombre
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');
    document.body.appendChild(overlay);

    // Créer la popup
    const popup = document.createElement('div');
    popup.classList.add('popup');
    
    let popupContent = `
        <div class="popup-content">
            <!-- Afficher le code et la question de qualification -->
            <table class="table-qualification">
                <tr>
                    <td><strong>Code Qualification:</strong> ${qualificationQuestion.id}</td>
                </tr>
                <tr>
                    <td>${qualificationQuestion.question}</td>
                    <td class="response-right">
                        <label>
                            <input type="radio" name="qualification_${qualificationQuestion.id}" value="yes" onchange="handleQualificationPopup(event, ${qualificationQuestion.id}, questionsValidation)"> Oui
                        </label>
                        <label>
                            <input type="radio" name="qualification_${qualificationQuestion.id}" value="no" onchange="handleQualificationPopup(event, ${qualificationQuestion.id}, questionsValidation)"> Non
                        </label>
                    </td>
                </tr>
            </table>

            <!-- Tableau pour les questions de validation -->
            <table class="table-activation">
                <thead>
                    <tr>
                        <th>Questions de Validation</th>
                        <th class="litle">Réponse</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Variable pour déterminer si un point bloquant définitif est présent
    let hasDefinitiveBlockingPoint = false;

    // Ajouter chaque validation dans le tableau
    validations.forEach(validation => {
        const isPointBloquantTousCas = validation.point_bloquant_tous_cas && validation.point_bloquant_tous_cas.trim() === "X";
        const isPointBloquantSiNon = validation.point_bloquant_non && validation.point_bloquant_non.trim() === "X";
        const isValidation = !isPointBloquantTousCas && !isPointBloquantSiNon;
        const isValidationAlreadyAnswered = responses[`validation_${validation.id}`] === 'yes';

        // Si c'est un point bloquant "CR à réaliser dans tous les cas"
        if (isPointBloquantTousCas) {
            hasDefinitiveBlockingPoint = true;  // Indiquer que c'est un point bloquant définitif
            popupContent += `
                <tr class="table-point-bloquant">
                    <td>(${validation.code}) ${validation.question}</td>
                    <td class="response-right">
                        <label>
                            <input type="radio" name="validation_${validation.id}" value="no" onchange="handleComprehension(${validation.id})"> Je comprends
                        </label>
                    </td>
                </tr>
            `;
        } 
        // Si c'est un point bloquant "CR à réaliser si coché NON"
        else if (isPointBloquantSiNon) {
            popupContent += `
                <tr>
                    <td>(${validation.code}) ${validation.question}</td>
                    <td class="response-right" class="litle">
                        <label>
                            <input type="radio" name="validation_${validation.id}" value="yes" onchange="handleValidationChange(${validation.id}, 'yes')"> Oui
                        </label>
                        <label>
                            <input type="radio" name="validation_${validation.id}" value="no" onchange="handleValidationChange(${validation.id}, 'no')"> Non
                        </label>
                    </td>
                </tr>
            `;
        } 
        // Sinon, c'est une validation normale
        else if (isValidation && !isValidationAlreadyAnswered) {
            popupContent += `
                <tr>
                    <td>(${validation.code}) ${validation.question}</td>
                    <td class="response-right" class="litle">
                        <label>
                            <input type="radio" name="validation_${validation.id}" value="yes" onchange="handleValidationChange(${validation.id}, 'yes')"> Oui
                        </label>
                        <label>
                            <input type="radio" name="validation_${validation.id}" value="no" onchange="handleValidationChange(${validation.id}, 'no')"> Non
                        </label>
                    </td>
                </tr>
            `;
        }
    });

    popupContent += `
                </tbody>
            </table>
    `;

    // Si c'est un point bloquant définitif, le texte du bouton change
    let buttonText = hasDefinitiveBlockingPoint ? "Valider" : "Soumettre";

    // Ajouter le bouton de soumission
    popupContent += `
        <button onclick="submitPopup(${qualificationQuestion.id}, JSON.parse('${JSON.stringify(validations.map(v => v.id))}'))">${buttonText}</button>
        </div>
    `;

    popup.innerHTML = popupContent;
    document.body.appendChild(popup);

    // Prérenseigner la réponse de qualification dans le popup
    document.querySelector(`input[name="qualification_${qualificationQuestion.id}"][value="${responses[qualificationQuestion.id]}"]`).checked = true;
}







// Soumettre les réponses aux questions de validation
function submitPopup(qualificationId, validationIds) {
    let allValidationsAnswered = true;

    // Vérifier que chaque validation a une réponse ou est un point bloquant définitif
    validationIds.forEach(validationId => {
        const validationOption = document.querySelector(`input[name="validation_${validationId}"]:checked`);
        
        // Si la validation est un point bloquant définitif, ignorer la vérification des réponses
        if (responses[`validation_definitive_blocking_${validationId}`] === 'yes') {
            // Point bloquant définitif : pas besoin de vérifier la réponse, il est validé automatiquement
            return;
        }

        // Pour les autres validations, vérifier s'il y a une réponse
        if (!validationOption) {
            allValidationsAnswered = false;  // Il manque une réponse à une validation
        } else {
            // Enregistrer la réponse pour chaque validation non bloquante
            responses[`validation_${validationId}`] = validationOption.value;
        }
    });

    if (!allValidationsAnswered) {
        alert("Veuillez répondre à toutes les questions de validation avant de soumettre.");
        return;
    }

    // Fermer la popup et réactiver le formulaire
    closePopup();
    enableQualificationForm();  // Réactiver le formulaire principal
}


// Gérer la réponse à la question de qualification dans le popup
function handleQualificationPopup(event, questionId, questionsValidation) {
    const selectedOption = event.target.value;

    // Si l'utilisateur sélectionne "Non", réinitialiser les réponses des validations liées
    if (selectedOption === 'no') {
        responses[questionId] = 'no';
        document.querySelector(`input[name="question_${questionId}"][value="no"]`).checked = true; // Met à jour dans le tableau
        
        // Parcourir toutes les questions de validation liées à cette question de qualification
        questionsValidation.forEach(validation => {
            const codes = validation.code.split('+').map(code => code.trim());

            // Vérifier si cette validation est liée à la question de qualification actuelle
            if (codes.includes(String(questionId))) {
                // Annuler la réponse de validation dans le dictionnaire
                delete responses[`validation_${validation.id}`];

                // Désélectionner l'option dans l'interface utilisateur
                const yesOption = document.querySelector(`input[name="validation_${validation.id}"][value="yes"]`);
                const noOption = document.querySelector(`input[name="validation_${validation.id}"][value="no"]`);

                if (yesOption) yesOption.checked = false;
                if (noOption) noOption.checked = false;

                // Supprimer cette question du tableau des points bloquants
                removePointBloquant(validation.id);
            }
        });

        closePopup();  // Fermer la popup et retirer l'overlay
        enableQualificationForm();  // Réactiver le formulaire principal

        // Mettre à jour le résumé des points bloquants après suppression des réponses
        updatePointsBloquantsSummary();
    } else {
        responses[questionId] = 'yes';
        document.querySelector(`input[name="question_${questionId}"][value="yes"]`).checked = true; // Met à jour dans le tableau
    }
}



// Fermer la popup et enlever l'overlay
function closePopup() {
    const popup = document.querySelector('.popup');
    const overlay = document.querySelector('.overlay');
    if (popup) {
        popup.remove();
    }
    if (overlay) {
        overlay.remove();
    }
    popupOpen = false; // Réinitialiser l'état du popup
}

// Désactiver toutes les questions de qualification
function disableQualificationForm() {
    const inputs = document.querySelectorAll('input[type="radio"]');
    inputs.forEach(input => {
        input.disabled = true;  // Désactiver tous les inputs
    });
}

// Réactiver le formulaire de qualification
function enableQualificationForm() {
    const inputs = document.querySelectorAll('input[type="radio"]');
    inputs.forEach(input => {
        input.disabled = false;  // Réactiver tous les inputs
    });
}

class FactorsController < ApplicationController
  before_action :find_day, only: [:create]
  before_action :find_category, only: [:create]
  before_action :find_factor, only: [:show, :update, :destroy]
  before_action :find_factors, only: [:index, :filter]

  def index
    authorize @factors
    render json: @factors
  end

  def show
    authorize @factor
    render json: @factor
  end

  def filter
    @factors = @factors.where(id: permitted_attributes(resource_class)[:id]) if params[:filter].key?(:id)

    authorize @factors
    render json: @factors
  end

  def create
    @factor = resource_class.new create_params

    if @factor.save
      authorize @factor
      render json: @factor, status: :created, location: @factor
    else
      skip_authorization
      render json: @factor.errors, status: :unprocessable_entity
    end
  end

  def update
    throw NotImplementedError
  end

  def destroy
    throw NotImplementedError
  end

  protected

  def create_params
    permitted_attributes(resource_class).merge(
      user: current_user,
      day: @day
    )
  end

  def update_params
    permitted_attributes(@factor)
  end

  def find_day
    @day = policy_scope(Day).find_by(id: params.dig(:data, :relationships, :day, :data, :id))
  end

  def find_category
    @category = policy_scope(Category).find_by(id: params.dig(:data, :relationships, :category, :data, :id))
  end

  def find_factor
    @factor = policy_scope(resource_class).find(params[:id])
  end

  def find_factors
    @factors = policy_scope(resource_class)
  end
end
